import { Option, Poll, Vote } from "./models/index";
import { emojiNumberMap } from "./utils";
import assert from "assert";

class OptionResult {
  public option!: Option;
  public score!: number;
  public numVoters!: number;
  public preferredOverBy!: Map<Option, number>;
  public numAbstains!: number;

  constructor() {
    this.preferredOverBy = new Map<Option, number>();
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
      if (optionVotes.length > 0 && optionVotes[0].optionId === this.option.id)
        return; // skip comparison with self
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
    // iterate on each vote given for an option
    for (const vote of optionVotes) {
      const option = await vote.getOption();
      // see if the same user voted on other options
      const userVotesForOtherOptions = userVotes.get(vote.userId);
      if (!userVotesForOtherOptions) continue;
      // filter out the same option
      const votesOtherOptions = userVotesForOtherOptions.filter(
        (otherVote) => vote.optionId !== otherVote.optionId,
      );
      votesOtherOptions.forEach((otherVote) => {
        const netPreference =
          vote.stars > otherVote.stars
            ? 1
            : vote.stars === otherVote.stars
              ? 0
              : -1;
        this.preferredOverBy.set(
          option,
          (this.preferredOverBy.get(option) || 0) + netPreference,
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

  constructor(public readonly poll: Poll) {}

  public async initialize(): Promise<this> {
    const allOptionsVotes = await this.fetchAllOptionsVotes();
    await this.createOptionResults(allOptionsVotes);
    this.determineWinner();
    return this;
  }

  private async fetchAllOptionsVotes(): Promise<Vote[][]> {
    const options = await this.poll.getOptions();
    return await Promise.all(options.map((option) => option.getVotes()));
  }

  private async createOptionResults(allOptionsVotes: Vote[][]): Promise<void> {
    for (const optionVotes of allOptionsVotes) {
      const optionResult = new OptionResult();
      await optionResult.initialize(optionVotes, allOptionsVotes);
      this.optionResults.push(optionResult);
    }
  }

  private determineWinner(): void {
    const sortedOptionResults = this.optionResults.sort(
      (a, b) => b.score - a.score,
    );

    const bestScore = sortedOptionResults[0];
    const secondBestScore = sortedOptionResults[1];

    if (bestScore.numVoters == 1 && secondBestScore.numVoters == 1) {
      // If both options have only one voter, we cannot determine a winner
      this.winnerResult = [bestScore, 0];
      return;
    }

    assert(
      bestScore.preferredOverBy.get(secondBestScore.option) ===
        -(secondBestScore.preferredOverBy.get(bestScore.option) || 0),
    );
    const winnerResult =
      (bestScore.preferredOverBy.get(secondBestScore.option) || 0) > 0
        ? bestScore
        : secondBestScore;
    this.winnerResult = [
      winnerResult,
      winnerResult.preferredOverBy.get(secondBestScore.option),
    ];
  }

  // TODO: refactor this to not query the database again
  public async getNVoters(): Promise<number> {
    const options = await this.poll.getOptions();
    const votersPerOption = await Promise.all(
      options.map(async (option) => (await option.getVotes()).length),
    );
    return Math.max(...votersPerOption);
  }
}

export { OptionResult, PollResults };
