from discord.components import ActionRow
import dotenv
import discord
import logging
import sys
from typing import List, Dict
from discord.ui import View, button, select, Select
from discord import option
from sqlmodel import Session, SQLModel, create_engine, Field, Relationship

# Set up logging
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger('star-voting-discord')

# Discord logging
discord_logger = logging.getLogger('discord')
discord_logger.setLevel(logging.DEBUG)

env = dotenv.dotenv_values(".env")
token = env["DISCORD_TOKEN"]
guild_id = env["GUILD_ID"]

logger.info("Starting Star Voting Discord Bot")


class Poll(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    question: str = Field()
    options: List["Option"] = Relationship(back_populates="poll")


class Vote(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    user_hash: int = Field()
    option_id: int = Field(default=None, foreign_key="option.id")
    option: "Option" = Relationship(back_populates="votes")

class Option(SQLModel, table=True):
    id: int = Field(default=None, primary_key=True)
    text: str = Field(default="")

    poll_id: int = Field(default=None, foreign_key="poll.id")
    poll: Poll = Relationship(back_populates="options")

    votes: List["Vote"] = Relationship(back_populates="option")

engine = create_engine("sqlite:///star_voting.db")
SQLModel.metadata.create_all(engine)
def get_session():
    with Session(engine) as session:
        yield session


bot = discord.Bot()


@bot.slash_command(name="hello", description="Say hello to the bot", guild_ids = [guild_id])
async def hello(ctx: discord.ApplicationContext):
    await ctx.respond("Hey! :one:")


select_options_args = {
    "placeholder": "Select number of stars to vote on",
    "options": [
        discord.SelectOption(label="⭐", value="1", description="1 star"),
        discord.SelectOption(label="⭐⭐", value="2", description="2 stars"),
        discord.SelectOption(label="⭐⭐⭐", value="3", description="3 stars"),
        discord.SelectOption(label="⭐⭐⭐⭐", value="4", description="4 stars"),
        discord.SelectOption(label="⭐⭐⭐⭐⭐", value="5", description="5 stars"),
    ]
}

emoji_number_map = {
0: ":one:", # I know how to count but python stars from 0 and humans from 1
1: ":two:",
2: ":three:",
3: ":four:",
4: ":five:",
}

def get_option_decorator(i, option: Option):
    i_emoji = emoji_number_map[i]
    print(i)
    print(option.id)
    return select(
        placeholder=f"{i_emoji} select stars to vote on: {option.text}",
        options=[
            discord.SelectOption(label=f"{i_emoji} :star:", value="1", description="1 star"),
            discord.SelectOption(label=f"{i_emoji} :star: :star:", value="2", description="2 stars"),
            discord.SelectOption(label=f"{i_emoji} :star: :star: :star:", value="3", description="3 stars"),
            discord.SelectOption(label=f"{i_emoji} :star: :star: :star: :star:", value="4", description="4 stars"),
            discord.SelectOption(label=f"{i_emoji} :star: :star: :star: :star: :star:", value="5", description="5 stars"),
        ],
        custom_id=f"option_{option.id}",
        # row=i+1
    )

async def option_handler(self, select: Select, interaction: discord.Interaction):
    print(select)
    await interaction.response.send_message(f"Option selected! {select.values[0]}", ephemeral=True)



def get_voting_view(poll: Poll):
    attrs = {}
    for i, option in enumerate(poll.options):
        attrs[f"option_{i}"] = get_option_decorator(i, option)(option_handler)

    VotingView = type("VotingView", (View,), attrs)
    return VotingView()


@bot.slash_command(name="create_poll", description="Create a STAR voting poll", guild_ids = [guild_id])
@option("question", description="The question for the poll")
@option("option1", description="First option for the poll")
@option("option2", description="Second option for the poll")
@option("option3", description="Third option for the poll", required=False, default="")
@option("option4", description="Fourth option for the poll", required=False, default="")
@option("option5", description="Fifth option for the poll", required=False, default="")
async def create_poll(
    ctx: discord.ApplicationContext,
    question: str,
    option1: str,
    option2: str,
    option3: str = "",
    option4: str = "",
    option5: str = "",
    option6: str = "",
):
    # Create poll object
    poll = Poll(question=question,
        options = [Option(text=op) for op in [option1, option2, option3, option4, option5, option6] if op]
    )

    # Save poll to database
    with Session(engine) as session:
        session.add(poll)
        session.commit()
        session.refresh(poll)

        view = get_voting_view(poll) # need to happen inside session context manager

    # Respond to the interaction
    await ctx.respond(f"Poll created (id: {poll.id}): {question}", view=view)


@bot.slash_command(name="help", description="Get help with the bot", guild_ids = [guild_id])
@option("echo", description="Echo a message")
async def help(ctx: discord.ApplicationContext, echo: str):
    embed = discord.Embed(title="Help", description=echo)
    await ctx.respond(embed=embed)

bot.run(token)
