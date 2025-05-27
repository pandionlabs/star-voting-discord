import { Option, Poll, Vote } from "./models/index";
import { emojiNumberMap } from "./utils";

class OptionResult {
  public option: Option;
  public score: number;
  public preferredOverBy: Map<Option, number>; // how many times this option was preferred over another option
  public numAbstains: number;

  constructor(optionVotes: Vote[], otherOptionsVotes: Vote[][]) {
    this.option = await optionVotes[0].getOption();
    const sumScores = optionVotes.reduce((acc, vote) => acc + vote.stars, 0);
    this.score = sumScores / optionVotes.length;
    // group votes by user id
    const userVotes = new Map<string, Vote[]>();
    otherOptionsVotes.forEach((optionVotes) => {
      optionVotes.forEach((vote) => {
        if (!userVotes.has(vote.userId)) userVotes.set(vote.userId, []);
        userVotes.get(vote.userId)!.push(vote);
      });
    });

    // an abstain is either a 0 stars or a userId that voted for at least one other option but not this one.
    const abstainsImplicit = userVotes.size - optionVotes.length;
    const abstainsExplicit = optionVotes.filter((vote) => vote.stars === 0).length;
    this.numAbstains = abstainsImplicit + abstainsExplicit;

    // preferredOverBy
    // iterate on each vote given for an option
    optionVotes.forEach((vote) => {
      const option = await vote.getOption();
      // see if the same user voted on other options
      const userVotesForOtherOptions = userVotes.get(vote.userId);
      if (!userVotesForOtherOptions) return;
      // filter the same option
      const votesOtherOptions = userVotesForOtherOptions.filter((otherVote) => otherVote.getOption().then(
        (otherOption) => otherOption.id == option.id
      ));
      votesOtherOptions.forEach((otherVote) => {
        const netPreference = vote.stars > otherVote.stars ? 1 : vote.stars === otherVote.stars ? 0 : -1;
        this.preferredOverBy.set(option, (this.preferredOverBy.get(option) || 0) + netPreference);
      })
    })

  }

  toString(): string {
    return `${emojiNumberMap[this.option.index]} ${this.option.text}: ${this.score.toFixed(2)} :star:`;
  }
}

class PollResults {
  public readonly OptionResults: OptionResult[];
  constructor(public readonly poll: Poll) {
    const options = await poll.getOptions();
    const votes = await Promise.all(options.map((option) => option.getVotes()));

    const optionResults = votes.map((vote) => {
      const otherVotes = votes.filter((otherVote) => otherVote.optionId !== vote.optionId);
      return new OptionResult(vote, otherVotes);
    });


    const sortedScores = scores.sort((a, b) => b - a);

    const best = sortedScores[0];
    const secondBest = sortedScores[1];




  }


  }

  public async getWinner(): Promise<VoteResult> {
    const results = await this.getResults();
    return results.sort((a, b) => b.score - a.score)[0];
  }

  public async getNVoters(): Promise<number> {
    const options = await this.getOptions();
    const votersPerOption = await Promise.all(
      options.map(async (option) => (await option.getVotes()).length),
    );
    return Math.max(...votersPerOption);
  }
}
