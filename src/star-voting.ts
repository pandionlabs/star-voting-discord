import { Option, Poll, Vote } from "./models/index";
import { emojiNumberMap } from "./utils";
import assert from "assert";
/*
The results of the votes are tabulated following the STAR voting procedure (https://www.starvoting.org/)For each decision, the ballots are processed in two steps:
- Step 1. The two options with the highest average score are selected for the automatic run-off
- Step 2. In the automatic run-off between the two best options, each ballot counts as one vote for the finalist. For each ballot The finalist with the highest score in the ballot gets one preference more, regardless of the actual score of the finalists.
In case of a draw (scores for both finalists are the same) or the voter  abstained for one of the finalist, no candidate get the preferenceThe finalist with the highest number of preference wins
In case of a draw in the number of preferences, the candidate with the highest score wins.
*/

class OptionResult {
  public option!: Option;
  public score!: number;
  public numVoters!: number;
  public preferredOverBy!: Map<Number, number>;
  public numAbstains!: number;

  constructor() {
    this.preferredOverBy = new Map<number, number>();
  }

  public async initialize(
    optionVotes: Vote[],
    allOptionsVotes: Vote[][],
  ): Promise<void> {
    await this.setOption(optionVotes);
    this.calculateScore(optionVotes);
    const userVotes = this.groupVotesByUser(allOptionsVotes);
    this.numVoters = optionVotes.length;
    this.calculateAbstains(optionVotes, userVotes);
    await this.calculatePreferences(optionVotes, userVotes);
  }

  private async setOption(optionVotes: Vote[]): Promise<void> {
    this.option = await optionVotes[0].getOption();
  }

  private calculateScore(optionVotes: Vote[]): void {
    const sumScores = optionVotes.reduce((acc, vote) => acc + vote.stars, 0);
    this.score = sumScores / optionVotes.length;
  }

  private groupVotesByUser(allOptionsVotes: Vote[][]): Map<string, Vote[]> {
    const userVotes = new Map<string, Vote[]>();
    allOptionsVotes.forEach((optionVotes) => {
      optionVotes.forEach((vote) => {
        if (!userVotes.has(vote.userId)) userVotes.set(vote.userId, []);
        userVotes.get(vote.userId)!.push(vote);
      });
    });
    return userVotes;
  }

  private calculateAbstains(
    optionVotes: Vote[],
    userVotes: Map<string, Vote[]>,
  ): void {
    // an abstain is either a 0 stars or a userId that voted for at least one other option but not this one.
    const abstainsImplicit = userVotes.size - optionVotes.length;
    const abstainsExplicit = optionVotes.filter(
      (vote) => vote.stars === 0,
    ).length;
    this.numAbstains = abstainsImplicit + abstainsExplicit;
  }

  private async calculatePreferences(
    optionVotes: Vote[],
    userVotes: Map<string, Vote[]>,
  ): Promise<void> {
    // preferredOverBy
    // iterate on each vote (and theforore each user) given for an option
    for (const vote of optionVotes) {
      const option = await vote.getOption();
      // see if the same user voted on other options
      const userVotesOtherOptions = userVotes
        .get(vote.userId)!
        .filter((otherVote) => otherVote.optionId !== vote.optionId);
      if (!userVotesOtherOptions) continue;
      userVotesOtherOptions.forEach((otherVote) => {
        const netPreference =
          vote.stars > otherVote.stars
            ? 1
            : vote.stars === otherVote.stars
              ? 0
              : -1;

        const currentPreference =
          this.preferredOverBy.get(otherVote.optionId) || 0;
        this.preferredOverBy.set(
          otherVote.optionId,
          currentPreference + netPreference,
        );
      });
    }
  }

  toString(): string {
    return `${emojiNumberMap[this.option.index]} ${this.option.text}: ${this.score.toFixed(2)} :star:`;
  }
}

class PollResults {
  public readonly optionResults: OptionResult[] = [];
  public winnerResult: [OptionResult, number];
  public numVoters: number;

  constructor(public readonly poll: Poll) {}

  public async initialize(): Promise<this> {
    const allOptionsVotes = await this.fetchAllOptionsVotes();
    await this.createOptionResults(allOptionsVotes);
    // handle empty poll case
    if (this.optionResults.length == 0) {
      this.numVoters = 0;
      return this; // No options, no results
    }
    this.determineWinner();
    this.setNumVoters(allOptionsVotes);
    return this;
  }

  private async fetchAllOptionsVotes(): Promise<Vote[][]> {
    const options = await this.poll.getOptions();
    return await Promise.all(options.map((option) => option.getVotes()));
  }

  private async createOptionResults(allOptionsVotes: Vote[][]): Promise<void> {
    for (const optionVotes of allOptionsVotes) {
      const optionResult = new OptionResult();
      if (optionVotes.length === 0) continue; // Skip options with no votes
      await optionResult.initialize(optionVotes, allOptionsVotes);
      this.optionResults.push(optionResult);
    }
    this.optionResults.sort((a, b) => b.score - a.score);
  }

  private determineWinner(): void {
    const bestScore = this.optionResults[0];
    const secondBestScore = this.optionResults[1];

    // If there's no second option, or if both top options have only one voter each,
    // the winner is the one with the highest score (bestScore).
    // `numVoters` here is specific to the option, not total poll voters.
    // In PollResults an OptionResult is only created if optionVotes.length > 0, so numVoters >= 1.
    // The runoff preference score is 0 in this scenario, as no meaningful runoff comparison can be made.
    if (
      !secondBestScore ||
      (bestScore.numVoters === 1 && secondBestScore.numVoters === 1)
    ) {
      this.winnerResult = [bestScore, 0];
      return;
    }

    // This assertion checks the integrity of preference calculation.
    // It ensures that the preference of A over B is the negative of B over A.
    // The `|| 0` handles cases where an option might not be in the preferredOverBy map if no common voters.
    const preferenceOfBestOverSecond =
      bestScore.preferredOverBy.get(secondBestScore.option.id) || 0;
    const preferenceOfSecondOverBest =
      secondBestScore.preferredOverBy.get(bestScore.option.id) || 0;

    assert(
      preferenceOfBestOverSecond === -preferenceOfSecondOverBest,
      `Symmetric preference check failed. bestScore.option.id: ${bestScore.option.id}, secondBestScore.option.id: ${secondBestScore.option.id}, pref(best/second): ${preferenceOfBestOverSecond}, pref(second/best): ${preferenceOfSecondOverBest}. This is a bug in \`calculatePreferences\`.`,
    );

    let winningCandidate: OptionResult;
    let runoffPreferenceValue: number;

    if (preferenceOfBestOverSecond > 0) {
      // bestScore is preferred over secondBestScore.
      winningCandidate = bestScore;
      runoffPreferenceValue = preferenceOfBestOverSecond;
    } else if (preferenceOfBestOverSecond < 0) {
      // secondBestScore is preferred over bestScore.
      // This is where the different between Star voting and simple score voting shows up!
      winningCandidate = secondBestScore;
      // runoffPreferenceValue should be the positive margin of the winner.
      runoffPreferenceValue = -preferenceOfBestOverSecond;
    } else {
      // Preferences are tied (preferenceOfBestOverSecond === 0).
      // In this case, the candidate with the higher original score wins.
      // bestScore is already determined to have the higher (or equal) score due to initial sorting.
      winningCandidate = bestScore;
      runoffPreferenceValue = 0; // Preference score difference is 0 for a tie.
    }

    this.winnerResult = [winningCandidate, runoffPreferenceValue];
  }

  private setNumVoters(allOptionsVotes: Vote[][]): void {
    const allUserIds = new Set<string>();
    // Iterate over all options and then over all votes to find every unique user ID
    allOptionsVotes.forEach((optionVotes) =>
      optionVotes.forEach((vote) => allUserIds.add(vote.userId)),
    );
    this.numVoters = allUserIds.size;
  }
}

export { OptionResult, PollResults };
