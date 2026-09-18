# Tamagotchi MCP

A Model Context Protocol (MCP) server that provides a virtual Tamagotchi pet experience. Care for your digital companion through various interactions and watch them grow!

## Features

- 🥚 **Life Stages**: Egg → Baby → Child → Teen → Adult → Elder
- 📊 **Six Core Stats**: Hunger, Happiness, Health, Energy, Cleanliness, Discipline
- 🎮 **Interactive Care**: Feed, play, clean, and put to sleep
- 🎨 **ASCII Animations**: Cute visual representations for different moods and actions
- 🧬 **Species Variety**: Choose from Mametchi, Kuchipatchi, Ginjirotchi, or Hashitamatchi
- 💾 **Persistent State**: Your Tamagotchi remembers you between sessions
- ⏰ **Real-time Aging**: Stats decay over time, requiring regular care

## Installation

```bash
npx tamagotchi-mcp
```

Or install globally:

```bash
npm install -g tamagotchi-mcp
```

## MCP Configuration

Add to your Claude Desktop config file:

### macOS
`~/Library/Application Support/Claude/claude_desktop_config.json`

### Windows
`%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "tamagotchi": {
      "command": "npx",
      "args": ["tamagotchi-mcp"]
    }
  }
}
```

## Available Tools

### `create_tamagotchi`
Create a new Tamagotchi with a custom name and optional species.

**Parameters:**
- `name` (string): Name for your Tamagotchi
- `species` (optional): mametchi, kuchipatchi, ginjirotchi, or hashitamatchi

### `check_tamagotchi`
View your Tamagotchi's current status, including stats, mood, and ASCII art.

### `feed_tamagotchi`
Feed your Tamagotchi different types of food.

**Parameters:**
- `food_type` (optional): meal, snack, treat, or medicine

**Food Effects:**
- 🍽️ **Meal**: +25 hunger, +5 happiness
- 🍪 **Snack**: +10 hunger, +15 happiness
- 🍭 **Treat**: +5 hunger, +25 happiness
- 💊 **Medicine**: -5 hunger, -10 happiness, +30 health (cures sickness)

### `play_with_tamagotchi`
Play with your Tamagotchi using different activities.

**Parameters:**
- `play_type` (optional): ball, music, dance, or puzzle

**Play Effects:**
- ⚽ **Ball**: +20 happiness, -15 energy
- 🎵 **Music**: +25 happiness, -10 energy
- 💃 **Dance**: +30 happiness, -20 energy, +5 discipline
- 🧩 **Puzzle**: +15 happiness, -5 energy, +10 discipline

### `clean_tamagotchi`
Clean your Tamagotchi to improve cleanliness and health.

### `put_tamagotchi_to_sleep`
Put your Tamagotchi to sleep to restore energy.

### `wake_tamagotchi`
Wake up your sleeping Tamagotchi.

## Care Guide

### Stats Explained
- 🍽️ **Hunger**: Decreases over time, feed regularly
- 😊 **Happiness**: Affected by play and treats
- ❤️ **Health**: Can decrease if other stats are too low
- ⚡ **Energy**: Depletes during play, restored by sleep
- ✨ **Cleanliness**: Decreases over time, maintain with cleaning
- 🎯 **Discipline**: Increased through certain play activities

### Evolution
Your Tamagotchi evolves based on age and care quality:
- Day 0: 🥚 Egg
- Day 1+: 👶 Baby
- Day 3+: 🧒 Child
- Day 7+: 👦 Teen
- Day 14+: 👨 Adult
- Day 30+: 👴 Elder

### Health & Sickness
- Poor care (low hunger, happiness, or cleanliness) can make your Tamagotchi sick
- Sick Tamagotchis need medicine to recover
- Regular care prevents illness

## Environment Variables

- `TAMAGOTCHI_DATA_DIR`: Custom directory for saving Tamagotchi state (default: `~/.tamagotchi`)

## Development

```bash
# Clone and install dependencies
git clone <repository-url>
cd tamagotchi-mcp
npm install

# Build
npm run build

# Watch for changes during development
npm run watch

# Test with MCP Inspector
npm run inspector
```

## License

MIT License - see LICENSE file for details.

---

Take good care of your digital companion! 🐣✨