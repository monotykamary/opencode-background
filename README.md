# OpenCode Background Tasks Plugin

A flexible background task management plugin for OpenCode.

## Features

- Create background tasks with real-time output tracking
- Session-based task tracking
- Task tagging
- Advanced task filtering
- Task killing with multiple criteria

## Installation

```bash
bun add @zenobius/opencode-background
```

## Usage

### Creating a Background Task

```typescript
const taskId = await client.background_tasks.createBackgroundTask({
  command: "/path/to/long-running-script.sh",
  name: "Long Running Task",
  tags: ["long-task", "processing"]
})
```

### Listing Tasks

```typescript
// List tasks in current session
const currentSessionTasks = await client.background_tasks.listBackgroundTasks({
  sessionId: currentSessionId
})

// List tasks with specific tags
const processingTasks = await client.background_tasks.listBackgroundTasks({
  tags: ["processing"]
})
```

### Killing Tasks

```typescript
// Kill a specific task
await client.background_tasks.killTasks({
  taskId: "specific-task-id"
})

// Kill all tasks in a session
await client.background_tasks.killTasks({
  sessionId: currentSessionId
})
```

## License

[To be determined]