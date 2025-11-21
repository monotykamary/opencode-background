# OpenCode Background Processes Plugin

A flexible background process management plugin for OpenCode, offering robust process tracking and lifecycle management.

## Installation

Create or edit your OpenCode configuration file (typically `~/.config/opencode/config.json`):

```json
{
  "plugins": ["@zenobius/opencode-background"]
}
```

## Features

- 🚀 Create background processes with real-time output tracking
- 🏷️ Tag and categorize processes
- 🔍 Advanced process filtering
- 🔪 Selective process termination
- 🌐 Global and session-specific process support
- :recycle: Automatic cleanup on session end and application close

## Usage in OpenCode

### Creating a Background Process

```
⚙ createBackgroundProcess
  command=/tmp/long-process.sh
  name="Long Running Process"
  tags=["long-process", "processing"]
  global=false  # Optional: default is false
```

### Process Types

- **Session-Specific Processes** (default):
  - Automatically terminated when the session ends
  - Useful for temporary, session-bound operations
  - Tracked in-memory for the current session

- **Global Processes**:
  - Persist across sessions
  - Continues running until explicitly stopped
  - Useful for long-running services or background operations

### Listing Processes

```
# List processes in current session
⚙ listBackgroundProcesses
  sessionId=current_session_id

# List processes with specific tags
⚙ listBackgroundProcesses
  tags=["processing"]
```

### Killing Processes

```
# Kill a specific process
⚙ killProcesses
  processId=specific-process-id

# Kill all processes in a session
⚙ killProcesses
  sessionId=current_session_id
```

## Plugin Methods

### `createBackgroundProcess`

- `command`: Shell command to execute
- `name` (optional): Descriptive name for the process
- `tags` (optional): List of tags to categorize the process
- `global` (optional):
  - `false` (default): Session-specific process
  - `true`: Process persists across sessions

### `listBackgroundProcesses`

- `sessionId` (optional): Filter processes by session
- `status` (optional): Filter processes by status
- `tags` (optional): Filter processes by tags

### `killProcesses`

- `processId` (optional): Kill a specific process
- `sessionId` (optional): Kill processes in a specific session
- `status` (optional): Kill processes with a specific status
- `tags` (optional): Kill processes with specific tags

## Considerations

- Processes are tracked in-memory using a singleton `BackgroundProcessManager`
- Output stream captures up to the last 100 lines of process output
- Processes can be in states: `pending`, `running`, `completed`, `failed`, `cancelled`
- Processes include detailed metadata: start/completion times, error tracking
- ALL processes are killed when OpenCode closes
- Processes generate unique IDs automatically if not specified

## Contributing

Contributions are welcome! Please file issues or submit pull requests on the GitHub repository.

## License

MIT License. See the [LICENSE](LICENSE) file for details.
