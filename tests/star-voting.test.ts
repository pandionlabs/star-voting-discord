import { Poll, Option, Vote } from "../src/models";
import { OptionResult, PollResults } from "../src/star-voting";

describe("OptionResult", () => {
  let poll: Poll;
  let option1: Option;
  let option2: Option;
  let option3: Option;

  beforeEach(async () => {
    poll = await Poll.create({
      question: "Test poll question?",
    });

    option1 = await Option.create({
      text: "Option A",
      index: 0,
      pollId: poll.id,
    });

    option2 = await Option.create({
      text: "Option B",
      index: 1,
      pollId: poll.id,
    });

    option3 = await Option.create({
      text: "Option C",
      index: 2,
      pollId: poll.id,
    });
  });

  describe("initialization", () => {
    it("should initialize with basic vote data", async () => {
      const votes = [
        await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 }),
        await Vote.create({ userId: "user2", optionId: option1.id, stars: 3 }),
        await Vote.create({ userId: "user3", optionId: option1.id, stars: 4 }),
      ];

      const otherVotes = [
        [
          await Vote.create({
            userId: "user1",
            optionId: option2.id,
            stars: 2,
          }),
        ],
        [
          await Vote.create({
            userId: "user2",
            optionId: option3.id,
            stars: 1,
          }),
        ],
      ];

      const optionResult = new OptionResult();
      await optionResult.initialize(votes, [votes, ...otherVotes]);

      expect(optionResult.option.id).toBe(option1.id);
      expect(optionResult.score).toBe(4); // (5+3+4)/3
      expect(optionResult.numVoters).toBe(3);
    });

    it("sexplicit abstains (score is 0)", async () => {
      const votes = [
        await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 }),
        await Vote.create({ userId: "user2", optionId: option1.id, stars: 0 }),
        await Vote.create({ userId: "user3", optionId: option1.id, stars: 3 }),
      ];


      const optionResult = new OptionResult();
      await optionResult.initialize(votes, [votes]);

      expect(optionResult.numAbstains).toBe(1); // 1 explicit (user2 with 0 stars) 
    });

    it("implicit abstains (no vote for current option)", async () => {
      const votes = [
        await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 }),
        await Vote.create({ userId: "user2", optionId: option1.id, stars: 3 }),
      ];

      const otherVotes = [
        [
          await Vote.create({
            userId: "user3",
            optionId: option2.id,
            stars: 4,
          }),
          await Vote.create({
            userId: "user4",
            optionId: option2.id,
            stars: 2,
          }),
        ],
      ];

      const optionResult = new OptionResult();
      await optionResult.initialize(votes, [votes, ...otherVotes]);

      expect(optionResult.numAbstains).toBe(2); // user3 and user4 voted for other options but not this one
    });
    
    it("Abstains implicit + explicit", async () => {
      const votes = [
        await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 }),
        await Vote.create({ userId: "user2", optionId: option1.id, stars: 0 }),
      ];

      const otherVotes = [
        [
          await Vote.create({
            userId: "user3",
            optionId: option2.id,
            stars: 4,
          }),
          await Vote.create({
            userId: "user4",
            optionId: option2.id,
            stars: 2,
          }),
        ],
      ];

      const optionResult = new OptionResult();
      await optionResult.initialize(votes, [votes, ...otherVotes]);

      expect(optionResult.numAbstains).toBe(3); // user3 and user4 implict + user2 explicit
    });


  });

  describe("preference calculations", () => {
    it("should calculate preferences correctly when option is preferred", async () => {
      const option1Votes = [
        await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 }),
        await Vote.create({ userId: "user2", optionId: option1.id, stars: 4 }),
      ];

      const option2Votes = [
        await Vote.create({ userId: "user1", optionId: option2.id, stars: 2 }),
        await Vote.create({ userId: "user2", optionId: option2.id, stars: 3 }),
      ];

      const optionResult = new OptionResult();
      await optionResult.initialize(option1Votes, [option1Votes, option2Votes]);

      // user1: option1(5) > option2(2) = +1
      // user2: option1(4) > option2(3) = +1
      // Total preference over option2 should be +2
      expect(optionResult.preferredOverBy.get(option2.id)).toBe(2);
    });

    it("should calculate preferences correctly when option is not preferred", async () => {
      const option1Votes = [
        await Vote.create({ userId: "user1", optionId: option1.id, stars: 2 }),
        await Vote.create({ userId: "user2", optionId: option1.id, stars: 1 }),
      ];

      const option2Votes = [
        await Vote.create({ userId: "user1", optionId: option2.id, stars: 5 }),
        await Vote.create({ userId: "user2", optionId: option2.id, stars: 4 }),
      ];

      const optionResult = new OptionResult();
      await optionResult.initialize(option1Votes, [option1Votes, option2Votes]);

      // user1: option1(2) < option2(5) = -1
      // user2: option1(1) < option2(4) = -1
      // Total preference over option2 should be -2
      expect(optionResult.preferredOverBy.get(option2.id)).toBe(-2);
    });

    it("should handle tied preferences correctly", async () => {
      const option1Votes = [
        await Vote.create({ userId: "user1", optionId: option1.id, stars: 3 }),
        await Vote.create({ userId: "user2", optionId: option1.id, stars: 5 }),
      ];

      const option2Votes = [
        await Vote.create({ userId: "user1", optionId: option2.id, stars: 3 }),
        await Vote.create({ userId: "user2", optionId: option2.id, stars: 2 }),
      ];

      const optionResult = new OptionResult();
      await optionResult.initialize(option1Votes, [option1Votes, option2Votes]);

      // user1: option1(3) = option2(3) = 0
      // user2: option1(5) > option2(2) = +1
      // Total preference over option2 should be +1
      expect(optionResult.preferredOverBy.get(option2.id)).toBe(1);
    });
  });

  describe("toString", () => {
    it("should format option result correctly", async () => {
      const votes = [
        await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 }),
        await Vote.create({ userId: "user2", optionId: option1.id, stars: 3 }),
      ];

      const optionResult = new OptionResult();
      await optionResult.initialize(votes, [votes]);

      const result = optionResult.toString();
      expect(result).toBe("1️⃣ Option A: 4.00 :star:");
    });
  });
});

describe("PollResults", () => {
  let poll: Poll;
  let option1: Option;
  let option2: Option;
  let option3: Option;

  beforeEach(async () => {
    poll = await Poll.create({
      question: "Test poll question?",
    });

    option1 = await Option.create({
      text: "Option A",
      index: 0,
      pollId: poll.id,
    });

    option2 = await Option.create({
      text: "Option B",
      index: 1,
      pollId: poll.id,
    });

    option3 = await Option.create({
      text: "Option C",
      index: 2,
      pollId: poll.id,
    });
  });

  describe("STAR voting algorithm", () => {
    it("should select winner based on highest score when clear preference exists", async () => {
      // Option 1: High scores, preferred in runoff
      await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 });
      await Vote.create({ userId: "user2", optionId: option1.id, stars: 5 });
      await Vote.create({ userId: "user3", optionId: option1.id, stars: 4 });

      // Option 2: Medium scores
      await Vote.create({ userId: "user1", optionId: option2.id, stars: 3 });
      await Vote.create({ userId: "user2", optionId: option2.id, stars: 3 });
      await Vote.create({ userId: "user3", optionId: option2.id, stars: 2 });

      // Option 3: Low scores
      await Vote.create({ userId: "user1", optionId: option3.id, stars: 1 });
      await Vote.create({ userId: "user2", optionId: option3.id, stars: 2 });
      await Vote.create({ userId: "user3", optionId: option3.id, stars: 1 });

      const pollResults = await new PollResults(poll).initialize();

      expect(pollResults.winnerResult[0].option.id).toBe(option1.id);
      expect(pollResults.winnerResult[1]).toBeGreaterThan(0);
    });

    it("should handle runoff correctly when second-highest score wins preference", async () => {
      // Option 1: Highest average score but loses in runoff
      await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 });
      await Vote.create({ userId: "user2", optionId: option1.id, stars: 4 });
      await Vote.create({ userId: "user3", optionId: option1.id, stars: 4 }); 

      // Option 2: Second highest score but wins runoff
      await Vote.create({ userId: "user1", optionId: option2.id, stars: 1 });
      await Vote.create({ userId: "user2", optionId: option2.id, stars: 5 });
      await Vote.create({ userId: "user3", optionId: option2.id, stars: 5 }); 

      // Option 3: Lower scores
      await Vote.create({ userId: "user1", optionId: option3.id, stars: 2 });
      await Vote.create({ userId: "user2", optionId: option3.id, stars: 2 });
      await Vote.create({ userId: "user3", optionId: option3.id, stars: 2 });

      const pollResults = await new PollResults(poll).initialize();

      // Option 1 should have higher average score
      const option1Result = pollResults.optionResults.find(
        (r) => r.option.id === option1.id,
      )!;
      const option2Result = pollResults.optionResults.find(
        (r) => r.option.id === option2.id,
      )!;

      expect(option1Result.score).toBeGreaterThan(option2Result.score);

      // But option 2 should win due to runoff preference
      expect(pollResults.winnerResult[0].option.id).toBe(option2.id);
    });

    it("should handle edge case with only one voter per top option", async () => {
      // Only one vote each for top options
      await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 });
      await Vote.create({ userId: "user1", optionId: option2.id, stars: 4 });
      await Vote.create({ userId: "user1", optionId: option3.id, stars: 1 });

      const pollResults = await new PollResults(poll).initialize();

      expect(pollResults.winnerResult[0].option.id).toBe(option1.id);
      expect(pollResults.winnerResult[1]).toBe(0); // No preference calculation with single voters
    });

    it("should sort options by score correctly", async () => {
      // Create votes with different average scores
      await Vote.create({ userId: "user1", optionId: option1.id, stars: 2 });
      await Vote.create({ userId: "user2", optionId: option1.id, stars: 3 });

      await Vote.create({ userId: "user1", optionId: option2.id, stars: 4 });
      await Vote.create({ userId: "user2", optionId: option2.id, stars: 5 });

      await Vote.create({ userId: "user1", optionId: option3.id, stars: 1 });
      await Vote.create({ userId: "user2", optionId: option3.id, stars: 2 });

      const pollResults = await new PollResults(poll).initialize();

      // Should be sorted by score: option2 (4.5), option1 (2.5), option3 (1.5)
      expect(pollResults.optionResults[0].option.id).toBe(option2.id);
      expect(pollResults.optionResults[1].option.id).toBe(option1.id);
      expect(pollResults.optionResults[2].option.id).toBe(option3.id);
    });
  });

  describe("voter counting", () => {
    it("should return correct number of voters", async () => { 
      await Vote.create({ userId: "user1", optionId: option1.id, stars: 2 });
      await Vote.create({ userId: "user2", optionId: option1.id, stars: 3 });

      await Vote.create({ userId: "user1", optionId: option2.id, stars: 4 });
      await Vote.create({ userId: "user2", optionId: option2.id, stars: 5 });

      await Vote.create({ userId: "user1", optionId: option3.id, stars: 1 });
      await Vote.create({ userId: "user2", optionId: option3.id, stars: 2 });

      const pollResults = await new PollResults(poll).initialize();

      expect(pollResults.numVoters).toBe(2); 
    });

    it("should handle empty poll", async () => {
      const pollResults = await new PollResults(poll).initialize();
      const nVoters = await pollResults.getNVoters();

      expect(nVoters).toBe(0);
    });
  });

  describe("complex scenarios", () => {
    it("should handle abstentions and zero votes correctly", async () => {
      // Some users abstain (give 0 stars) or don't vote at all
      await Vote.create({ userId: "user1", optionId: option1.id, stars: 5 });
      await Vote.create({ userId: "user1", optionId: option2.id, stars: 0 }); // Explicit abstention
      // user1 doesn't vote for option3 (implicit abstention)

      await Vote.create({ userId: "user2", optionId: option2.id, stars: 4 });
      await Vote.create({ userId: "user2", optionId: option3.id, stars: 3 });
      // user2 doesn't vote for option1 (implicit abstention)

      const pollResults = await new PollResults(poll).initialize();

      const option1Result = pollResults.optionResults.find(
        (r) => r.option.id === option1.id,
      )!;
      const option2Result = pollResults.optionResults.find(
        (r) => r.option.id === option2.id,
      )!;
      const option3Result = pollResults.optionResults.find(
        (r) => r.option.id === option3.id,
      )!;

      expect(option1Result.numAbstains).toBe(1); // user2 didn't vote
      expect(option2Result.numAbstains).toBe(1); // user1 gave 0 stars
      expect(option3Result.numAbstains).toBe(1); // user1 didn't vote
    });
  });
});
