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
      // if (optionVotes.length > 0 && optionVotes[0].optionId === this.option.id)
      //   return; // skip comparison with self
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
      const userVotesOtherOptions = userVotes.get(vote.userId).filter(
        (otherVote) => otherVote.optionId !== vote.optionId,
      );
      if (!userVotesOtherOptions) continue;
      userVotesOtherOptions.forEach((otherVote) => {
        const netPreference =
          vote.stars > otherVote.stars
            ? 1
            : vote.stars === otherVote.stars
              ? 0
              : -1;
        
        const currentPreference = this.preferredOverBy.get(otherVote.optionId) || 0;
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
  public winnerResult!: [OptionResult, number];
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
    this.numVoters = await this.getNVoters();
    return this;
  }

  private async fetchAllOptionsVotes(): Promise<Vote[][]> {
    const options = await this.poll.getOptions();
    return await Promise.all(options.map((option) => option.getVotes()));
  }

  private async createOptionResults(allOptionsVotes: Vote[][]): Promise<void> {
    for (const optionVotes of allOptionsVotes) {
      const optionResult = new OptionResult();
      if (optionVotes.length === 0) continue // Skip options with no votes
      await optionResult.initialize(optionVotes, allOptionsVotes);
      this.optionResults.push(optionResult);
    }
    this.optionResults.sort(
      (a, b) => b.score - a.score,
    );
  }

  private determineWinner(): void {

    const bestScore = this.optionResults[0];
    const secondBestScore = this.optionResults[1];

    // If both options have only one voter or no votes on the second option, we cannot determine a winner using preferences
    if (!secondBestScore || (bestScore.numVoters <= 1 && secondBestScore.numVoters == 1)) {
      this.winnerResult = [bestScore, 0];
      return;
    }

    assert(
      bestScore.preferredOverBy.get(secondBestScore.option.id) ===
        -(secondBestScore.preferredOverBy.get(bestScore.option.id) || 0),
    );
    const winnerResult =
      (bestScore.preferredOverBy.get(secondBestScore.option.id) || 0) > 0
        ? bestScore
        : secondBestScore;
    this.winnerResult = [
      winnerResult,
      winnerResult.preferredOverBy.get(secondBestScore.option.id),
    ];
  }

  // TODO: refactor this to not query the database again
  async getNVoters(): Promise<number> {
    const options = await this.poll.getOptions();
    const votersPerOption = await Promise.all(
      options.map(async (option) => (await option.getVotes()).length),
    );
    return Math.max(...votersPerOption);
  }
}

export { OptionResult, PollResults };
