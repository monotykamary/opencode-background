import { execa } from 'execa';
import type { Plugin } from '@opencode-ai/plugin'
import { tool } from '@opencode-ai/plugin'

interface BackgroundTask {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  command: string
  outputStream: string[]
  startedAt?: Date
  completedAt?: Date
  error?: string
  sessionId: string
  tags: string[]
  pid?: number
}

export const BackgroundTasksPlugin: Plugin = async (ctx) => {
  const tasks: Map<string, BackgroundTask> = new Map()

  return {
    tool: {
      createBackgroundTask: tool({
        description: "Run a command as a background task with real-time output tracking, session tracking, and optional tags",
        args: {
          command: tool.schema.string(),
          name: tool.schema.string().optional(),
          tags: tool.schema.array(tool.schema.string()).optional(),
        },
        async execute(args, ctx) {
          const taskId = crypto.randomUUID()
          const sessionId = ctx.sessionID || 'unknown'

          // Run the task in the background
          const subprocess = execa(args.command, { 
            shell: true,
            stdout: 'pipe',
            stderr: 'pipe'
          })

          const task: BackgroundTask = {
            id: taskId,
            name: args.name || args.command,
            status: 'running',
            command: args.command,
            outputStream: [],
            startedAt: new Date(),
            sessionId: sessionId,
            tags: args.tags || [],
            pid: subprocess.pid
          }

          // Store the task
          tasks.set(taskId, task)

          // Capture streaming output
          subprocess.stdout?.on('data', (chunk) => {
            const line = chunk.toString().trim()
            if (line) task.outputStream.push(line)
          })

          subprocess.stderr?.on('data', (chunk) => {
            const line = chunk.toString().trim()
            if (line) task.outputStream.push(`[ERROR] ${line}`)
          })

          // Handle task completion or failure
          subprocess.then(() => {
            task.status = 'completed'
            task.completedAt = new Date()
          }).catch((error) => {
            task.status = 'failed'
            task.error = error.toString()
            task.outputStream.push(`[FATAL] ${error.toString()}`)
          })

          // Return task ID as a string
          return taskId
        }
      }),

      // Get task status and output
      getBackgroundTask: tool({
        description: "Retrieve details and output of a specific background task",
        args: {
          taskId: tool.schema.string()
        },
        async execute(args, ctx) {
          const task = tasks.get(args.taskId)
          if (!task) {
            throw new Error(`Task ${args.taskId} not found`)
          }
          const taskDetails = JSON.stringify({
            id: task.id,
            name: task.name,
            status: task.status,
            command: task.command,
            startedAt: task.startedAt?.toISOString() || '',
            completedAt: task.completedAt?.toISOString() || '',
            error: task.error || '',
            sessionId: task.sessionId,
            tags: task.tags,
            pid: task.pid,
            outputStream: task.outputStream.slice(-100) // Return last 100 lines
          })
          return taskDetails
        }
      }),

      // List all tasks with advanced filtering
      listBackgroundTasks: tool({
        description: "List background tasks with advanced filtering options",
        args: {
          sessionId: tool.schema.string().optional(),
          status: tool.schema.string().optional(),
          tags: tool.schema.array(tool.schema.string()).optional(),
        },
        async execute(args, ctx) {
          const filteredTasks = Array.from(tasks.values()).filter(task => {
            const sessionMatch = !args.sessionId || task.sessionId === args.sessionId
            const statusMatch = !args.status || task.status === args.status
            const tagMatch = !args.tags || 
              (args.tags.length === 0) || 
              args.tags.some(tag => task.tags.includes(tag))
            
            return sessionMatch && statusMatch && tagMatch
          })

          const taskList = filteredTasks.map(task => ({
            id: task.id,
            name: task.name,
            status: task.status,
            command: task.command,
            startedAt: task.startedAt?.toISOString() || '',
            completedAt: task.completedAt?.toISOString() || '',
            error: task.error || '',
            sessionId: task.sessionId,
            tags: task.tags,
            pid: task.pid,
            outputStream: task.outputStream.slice(-10) // Return last 10 lines of output
          }))
          return JSON.stringify(taskList)
        }
      }),

      // Kill tasks with advanced filtering
      killTasks: tool({
        description: "Kill background tasks with advanced filtering options",
        args: {
          taskId: tool.schema.string().optional(),
          sessionId: tool.schema.string().optional(),
          status: tool.schema.string().optional(),
          tags: tool.schema.array(tool.schema.string()).optional(),
        },
        async execute(args, ctx) {
          let killedTasks: string[] = []

          // Target specific task by ID
          if (args.taskId) {
            const task = tasks.get(args.taskId)
            if (task) {
              try {
                // Try to kill the process
                process.kill(task.pid || 0)
                task.status = 'cancelled'
                task.outputStream.push('[KILLED] Task forcibly terminated')
                killedTasks.push(task.id)
              } catch (error) {
                task.outputStream.push(`[KILL ERROR] ${error.toString()}`)
              }
              return JSON.stringify(killedTasks)
            }
          }

          // Filter and kill tasks based on criteria
          const tasksToKill = Array.from(tasks.values()).filter(task => {
            const sessionMatch = !args.sessionId || task.sessionId === args.sessionId
            const statusMatch = !args.status || task.status === args.status
            const tagMatch = !args.tags || 
              (args.tags.length === 0) || 
              args.tags.some(tag => task.tags.includes(tag))
            
            return sessionMatch && statusMatch && tagMatch
          })

          for (const task of tasksToKill) {
            try {
              // Try to kill the process
              process.kill(task.pid || 0)
              task.status = 'cancelled'
              task.outputStream.push('[KILLED] Task forcibly terminated')
              killedTasks.push(task.id)
            } catch (error) {
              task.outputStream.push(`[KILL ERROR] ${error.toString()}`)
            }
          }

          return JSON.stringify(killedTasks)
        }
      })
    }
  }
}