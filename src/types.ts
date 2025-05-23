import { Collection } from 'discord.js';

// Command structure
export interface Command {
  data: any;
  execute: (...args: any[]) => Promise<void>;
}

// Extended types for discord.js
declare module 'discord.js' {
  export interface Client {
    commands: Collection<string, Command>;
  }
}

// Database model types
export interface PollWithOptions {
  poll: {
    id: number;
    question: string;
  };
  options: Array<{
    id: number;
    text: string;
    pollId: number;
  }>;
}

// Vote summary types
export interface VoteSummary {
  optionId: number;
  optionText: string;
  totalStars: number;
  averageStars: number;
  voteCount: number;
}