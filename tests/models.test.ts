import { Poll, Option, Vote, sequelize } from '../src/models';

describe('Database Models', () => {
  describe('Poll Model', () => {
    it('should create a poll with required fields', async () => {
      const poll = await Poll.create({
        question: 'What is your favorite color?'
      });

      expect(poll.id).toBeDefined();
      expect(poll.question).toBe('What is your favorite color?');
      expect(poll.createdAt).toBeDefined();
      expect(poll.updatedAt).toBeDefined();
    });

    it('should not create a poll without a question', async () => {
      await expect(Poll.create({} as any)).rejects.toThrow();
    });

    it('should have options association', async () => {
      const poll = await Poll.create({
        question: 'Test poll'
      });

      const option1 = await Option.create({
        text: 'Option 1',
        index: 0,
        pollId: poll.id
      });

      const option2 = await Option.create({
        text: 'Option 2',
        index: 1,
        pollId: poll.id
      });

      const options = await poll.getOptions();
      expect(options).toHaveLength(2);
      expect(options.map(o => o.text)).toContain('Option 1');
      expect(options.map(o => o.text)).toContain('Option 2');
    });
  });

  describe('Option Model', () => {
    let poll: Poll;

    beforeEach(async () => {
      poll = await Poll.create({
        question: 'Test poll'
      });
    });

    it('should create an option with required fields', async () => {
      const option = await Option.create({
        text: 'Test option',
        index: 0,
        pollId: poll.id
      });

      expect(option.id).toBeDefined();
      expect(option.text).toBe('Test option');
      expect(option.index).toBe(0);
      expect(option.pollId).toBe(poll.id);
      expect(option.createdAt).toBeDefined();
      expect(option.updatedAt).toBeDefined();
    });

    it('should not create an option without required fields', async () => {
      await expect(Option.create({
        text: 'Test option'
      } as any)).rejects.toThrow();

      await expect(Option.create({
        index: 0,
        pollId: poll.id
      } as any)).rejects.toThrow();
    });

    it('should format option correctly', async () => {
      const option = await Option.create({
        text: 'Test option',
        index: 2,
        pollId: poll.id
      });

      expect(option.format()).toBe('3️⃣ Test option');
    });

    it('should have poll association', async () => {
      const option = await Option.create({
        text: 'Test option',
        index: 0,
        pollId: poll.id
      });

      const associatedPoll = await option.getPoll();
      expect(associatedPoll.id).toBe(poll.id);
      expect(associatedPoll.question).toBe(poll.question);
    });

    it('should have votes association', async () => {
      const option = await Option.create({
        text: 'Test option',
        index: 0,
        pollId: poll.id
      });

      const vote1 = await Vote.create({
        userId: 'user1',
        optionId: option.id,
        stars: 5
      });

      const vote2 = await Vote.create({
        userId: 'user2',
        optionId: option.id,
        stars: 3
      });

      const votes = await option.getVotes();
      expect(votes).toHaveLength(2);
      expect(votes.map(v => v.userId)).toContain('user1');
      expect(votes.map(v => v.userId)).toContain('user2');
    });
  });

  describe('Vote Model', () => {
    let poll: Poll;
    let option: Option;

    beforeEach(async () => {
      poll = await Poll.create({
        question: 'Test poll'
      });

      option = await Option.create({
        text: 'Test option',
        index: 0,
        pollId: poll.id
      });
    });

    it('should create a vote with required fields', async () => {
      const vote = await Vote.create({
        userId: 'user123',
        optionId: option.id,
        stars: 4
      });

      expect(vote.id).toBeDefined();
      expect(vote.userId).toBe('user123');
      expect(vote.optionId).toBe(option.id);
      expect(vote.stars).toBe(4);
      expect(vote.createdAt).toBeDefined();
      expect(vote.updatedAt).toBeDefined();
    });

    it('should not create a vote without required fields', async () => {
      await expect(Vote.create({
        userId: 'user123',
        stars: 4
      } as any)).rejects.toThrow();

      await expect(Vote.create({
        optionId: option.id,
        stars: 4
      } as any)).rejects.toThrow();

      await expect(Vote.create({
        userId: 'user123',
        optionId: option.id
      } as any)).rejects.toThrow();
    });

    it('should validate star count between 0 and 5', async () => {
      // Valid star counts
      await expect(Vote.create({
        userId: 'user1',
        optionId: option.id,
        stars: 0
      })).resolves.toBeDefined();

      await expect(Vote.create({
        userId: 'user2',
        optionId: option.id,
        stars: 5
      })).resolves.toBeDefined();

      // Invalid star counts
      await expect(Vote.create({
        userId: 'user3',
        optionId: option.id,
        stars: -1
      })).rejects.toThrow();

      await expect(Vote.create({
        userId: 'user4',
        optionId: option.id,
        stars: 6
      })).rejects.toThrow();
    });

    it('should have option association', async () => {
      const vote = await Vote.create({
        userId: 'user123',
        optionId: option.id,
        stars: 4
      });

      const associatedOption = await vote.getOption();
      expect(associatedOption.id).toBe(option.id);
      expect(associatedOption.text).toBe(option.text);
    });

    it('should allow same user to vote for different options', async () => {
      const option2 = await Option.create({
        text: 'Second option',
        index: 1,
        pollId: poll.id
      });

      const vote1 = await Vote.create({
        userId: 'user123',
        optionId: option.id,
        stars: 4
      });

      const vote2 = await Vote.create({
        userId: 'user123',
        optionId: option2.id,
        stars: 2
      });

      expect(vote1.userId).toBe(vote2.userId);
      expect(vote1.optionId).not.toBe(vote2.optionId);
    });
  });

  describe('Model Relationships', () => {
    it('should cascade delete options when poll is deleted', async () => {
      const poll = await Poll.create({
        question: 'Test poll'
      });

      const option = await Option.create({
        text: 'Test option',
        index: 0,
        pollId: poll.id
      });

      await poll.destroy();

      const deletedOption = await Option.findByPk(option.id);
      expect(deletedOption).toBeNull();
    });

    it('should cascade delete votes when option is deleted', async () => {
      const poll = await Poll.create({
        question: 'Test poll'
      });

      const option = await Option.create({
        text: 'Test option',
        index: 0,
        pollId: poll.id
      });

      const vote = await Vote.create({
        userId: 'user123',
        optionId: option.id,
        stars: 4
      });

      await option.destroy();

      const deletedVote = await Vote.findByPk(vote.id);
      expect(deletedVote).toBeNull();
    });

    it('should cascade delete all related data when poll is deleted', async () => {
      const poll = await Poll.create({
        question: 'Test poll'
      });

      const option1 = await Option.create({
        text: 'Option 1',
        index: 0,
        pollId: poll.id
      });

      const option2 = await Option.create({
        text: 'Option 2',
        index: 1,
        pollId: poll.id
      });

      const vote1 = await Vote.create({
        userId: 'user1',
        optionId: option1.id,
        stars: 5
      });

      const vote2 = await Vote.create({
        userId: 'user2',
        optionId: option2.id,
        stars: 3
      });

      await poll.destroy();

      const deletedOption1 = await Option.findByPk(option1.id);
      const deletedOption2 = await Option.findByPk(option2.id);
      const deletedVote1 = await Vote.findByPk(vote1.id);
      const deletedVote2 = await Vote.findByPk(vote2.id);

      expect(deletedOption1).toBeNull();
      expect(deletedOption2).toBeNull();
      expect(deletedVote1).toBeNull();
      expect(deletedVote2).toBeNull();
    });
  });

  describe('Database Connection', () => {
    it('should have a working database connection', async () => {
      await expect(sequelize.authenticate()).resolves.not.toThrow();
    });

    it('should sync models correctly', async () => {
      await expect(sequelize.sync()).resolves.not.toThrow();
    });
  });
});