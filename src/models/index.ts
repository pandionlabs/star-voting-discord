import { Sequelize, DataTypes, Model, Optional } from "sequelize";
import path from "path";
import { emojiNumberMap } from "../utils";

// Define interfaces for model attributes
interface PollAttributes {
  id: number;
  question: string;
}

interface PollCreationAttributes extends Optional<PollAttributes, "id"> {}

interface OptionAttributes {
  id: number;
  text: string;
  index: number; //then index inside the poll
  pollId: number;
}

interface OptionCreationAttributes extends Optional<OptionAttributes, "id"> {}

interface VoteAttributes {
  id: number;
  userId: string;
  optionId: number;
  stars: number;
}

interface VoteCreationAttributes extends Optional<VoteAttributes, "id"> {}

class VoteResult {
  option: Option;
  score: number;

  constructor(option: Option, score: number) {
    this.option = option;
    this.score = score;
  }

  toString(): string {
    return `${emojiNumberMap[this.option.index]} ${this.option.text}: ${this.score.toFixed(2)} :star:`;
  }
}

// Define model classes
class Poll
  extends Model<PollAttributes, PollCreationAttributes>
  implements PollAttributes
{
  public id!: number;
  public question!: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public getOptions!: () => Promise<Option[]>;
  public addOption!: (option: Option) => Promise<void>;

  public async getResults(): Promise<VoteResult[]> {
    const options = await this.getOptions();
    const votes = await Promise.all(options.map((option) => option.getVotes()));

    const scores = votes.map((vote) => {
      if (vote.length === 0) return 0;
      const sum = vote.reduce((acc, vote) => acc + vote.stars, 0);
      return sum / vote.length;
    });

    return options.map(
      (option, index) => new VoteResult(option, scores[index]),
    );
  }

  public async getWinner(): Promise<VoteResult> {
    const results = await this.getResults();
    return results.sort((a, b) => b.score - a.score)[0];
  }

  public async getNVoters(): Promise<number> {
    const options = await this.getOptions();
    const votes = await Promise.all(options.map((option) => option.getVotes()));
    return votes.length;
  }
}

class Option
  extends Model<OptionAttributes, OptionCreationAttributes>
  implements OptionAttributes
{
  public id!: number;
  public text!: string;
  public index!: number;
  public pollId!: number;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public getPoll!: () => Promise<Poll>;
  public getVotes!: () => Promise<Vote[]>;
  public addVote!: (vote: Vote) => Promise<void>;

  public format(): string {
    return `${emojiNumberMap[this.index]} ${this.text}`;
  }
}

class Vote
  extends Model<VoteAttributes, VoteCreationAttributes>
  implements VoteAttributes
{
  public id!: number;
  public userId!: string;
  public optionId!: number;
  public stars!: number;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public getOption!: () => Promise<Option>;
}

// Initialize Sequelize with SQLite
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: path.join(__dirname, "../../database.sqlite"),
  logging: console.log,
});

// Initialize models
Poll.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    question: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "polls",
  },
);

Option.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    text: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    index: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    pollId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    sequelize,
    tableName: "options",
  },
);

Vote.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    optionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    stars: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 0,
        max: 5,
      },
    },
  },
  {
    sequelize,
    tableName: "votes",
  },
);

// Set up relationships
Poll.hasMany(Option, {
  foreignKey: "pollId",
  onDelete: "CASCADE",
});
Option.belongsTo(Poll, {
  foreignKey: "pollId",
});

Option.hasMany(Vote, {
  foreignKey: "optionId",
  onDelete: "CASCADE",
});
Vote.belongsTo(Option, {
  foreignKey: "optionId",
});

// Sync models with the database
const syncDatabase = async (): Promise<void> => {
  try {
    await sequelize.sync();
    console.log("Database synced successfully");
  } catch (error) {
    console.error("Error syncing database:", error);
  }
};

export { sequelize, Poll, Option, Vote, syncDatabase };
