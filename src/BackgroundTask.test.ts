import { describe, it, expect, vi, beforeEach } from 'vitest';
import { execa } from 'execa';

// Mock execa
vi.mock('execa', () => ({
  execa: vi.fn(),
}));

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-12345';
Object.defineProperty(global, 'crypto', {
  value: {
    randomUUID: () => mockUUID,
  },
});

// Mock process.kill
const mockProcessKill = vi.fn();
Object.defineProperty(process, 'kill', {
  value: mockProcessKill,
});

// Import the BackgroundTask interface directly
interface BackgroundTask {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  command: string;
  outputStream: string[];
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  sessionId: string;
  tags: string[];
  pid?: number;
}

// Simplified BackgroundTaskManager for testing
class BackgroundTaskManager {
  private tasks: Map<string, BackgroundTask> = new Map();

  async createTask(
    command: string,
    name?: string,
    tags?: string[],
    sessionId?: string
  ): Promise<string> {
    const taskId = crypto.randomUUID();

    const subprocess = execa(command, {
      shell: true,
      stdout: 'pipe',
      stderr: 'pipe',
    }) as any;

    const task: BackgroundTask = {
      id: taskId,
      name: name || command,
      status: 'running',
      command: command,
      outputStream: [],
      startedAt: new Date(),
      sessionId: sessionId || 'unknown',
      tags: tags || [],
      pid: subprocess.pid,
    };

    this.tasks.set(taskId, task);

    subprocess.stdout?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) task.outputStream.push(line);
    });

    subprocess.stderr?.on('data', (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) task.outputStream.push(`[ERROR] ${line}`);
    });

    subprocess.then(() => {
      task.status = 'completed';
      task.completedAt = new Date();
    });

    subprocess.catch((error: Error) => {
      task.status = 'failed';
      task.error = error.toString();
      task.outputStream.push(`[FATAL] ${error.toString()}`);
    });

    return taskId;
  }

  getTask(taskId: string): BackgroundTask | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(filters?: { sessionId?: string; status?: string; tags?: string[] }): BackgroundTask[] {
    return Array.from(this.tasks.values()).filter((task) => {
      const sessionMatch = !filters?.sessionId || task.sessionId === filters.sessionId;
      const statusMatch = !filters?.status || task.status === filters.status;
      const tagMatch =
        !filters?.tags ||
        filters.tags.length === 0 ||
        filters.tags.some((tag) => task.tags.includes(tag));

      return sessionMatch && statusMatch && tagMatch;
    });
  }

  killTask(taskId: string): boolean {
    const task = this.tasks.get(taskId);
    if (!task) return false;

    try {
      process.kill(task.pid || 0);
      task.status = 'cancelled';
      task.outputStream.push('[KILLED] Task forcibly terminated');
      return true;
    } catch (error) {
      task.outputStream.push(`[KILL ERROR] ${String(error)}`);
      return false;
    }
  }

  killTasks(filters?: { sessionId?: string; status?: string; tags?: string[] }): string[] {
    const tasksToKill = this.listTasks(filters);
    const killedTasks: string[] = [];

    for (const task of tasksToKill) {
      if (this.killTask(task.id)) {
        killedTasks.push(task.id);
      }
    }

    return killedTasks;
  }
}

describe('Advanced BackgroundTaskManager Scenarios', () => {
  let manager: BackgroundTaskManager;
  let mockSubprocess: any;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new BackgroundTaskManager();

    mockSubprocess = {
      pid: 12345,
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
      },
      then: vi.fn().mockReturnThis(),
      catch: vi.fn().mockReturnThis(),
    };

    (execa as any).mockReturnValue(mockSubprocess);
  });

  describe('Stress and Edge Case Testing', () => {
    it('should handle large number of tasks', async () => {
      const taskCount = 50;
      const tasks = [];

      for (let i = 0; i < taskCount; i++) {
        Object.defineProperty(global, 'crypto', {
          value: {
            randomUUID: () => `task-${i}`,
          },
        });

        mockSubprocess.then.mockImplementation((callback: () => void) => {
          callback();
          return Promise.resolve();
        });

        tasks.push(
          await manager.createTask(
            `echo "Task ${i}"`,
            `Stress Test Task ${i}`,
            ['stress-test'],
            'stress-session'
          )
        );
      }

      // Reset UUID
      Object.defineProperty(global, 'crypto', {
        value: {
          randomUUID: () => mockUUID,
        },
      });

      const stressTestTasks = manager.listTasks({
        sessionId: 'stress-session',
        tags: ['stress-test'],
      });

      expect(stressTestTasks).toHaveLength(taskCount);
    });

    it('should handle tasks with extremely long outputs', async () => {
      const longOutput = 'x'.repeat(100_000); // 100KB of data
      const command = `echo "${longOutput}"`;

      mockSubprocess.then.mockImplementation((callback: () => void) => {
        setTimeout(() => {
          const stdoutCallback = mockSubprocess.stdout.on.mock.calls[0][1];
          stdoutCallback(Buffer.from(longOutput));
          callback();
        }, 10);
        return Promise.resolve();
      });

      const taskId = await manager.createTask(command, 'Long Output Task');

      await new Promise((resolve) => setTimeout(resolve, 20));

      const task = manager.getTask(taskId);

      expect(task?.outputStream).toContain(longOutput);
      expect(task?.outputStream.length).toBeGreaterThan(0);
    });
  });

  describe('Complex Task Management', () => {
    it('should handle concurrent kill operations', async () => {
      const tasks = [];
      const taskCount = 10;

      // Create multiple long-running tasks
      for (let i = 0; i < taskCount; i++) {
        Object.defineProperty(global, 'crypto', {
          value: {
            randomUUID: () => `task-${i}`,
          },
        });

        const subprocess = {
          pid: 10000 + i,
          stdout: { on: vi.fn() },
          stderr: { on: vi.fn() },
          then: vi.fn().mockReturnThis(),
          catch: vi.fn().mockReturnThis(),
        };

        (execa as any).mockReturnValue(subprocess);

        tasks.push(
          await manager.createTask(`sleep ${i + 1}`, `Concurrent Kill Task ${i}`, [
            'concurrent-kill',
          ])
        );
      }

      // Reset UUID
      Object.defineProperty(global, 'crypto', {
        value: {
          randomUUID: () => mockUUID,
        },
      });

      // Simulate killing all tasks concurrently
      mockProcessKill.mockImplementation((pid: number) => {
        // Simulate some kills might fail
        if (pid % 2 === 0) {
          throw new Error('Process kill failed');
        }
        return true;
      });

      const killedTasks = manager.killTasks({ tags: ['concurrent-kill'] });

      // Some tasks should be killed, some might fail
      expect(killedTasks.length).toBeGreaterThan(0);
      expect(killedTasks.length).toBeLessThan(taskCount);

      // Verify tasks are marked appropriately
      killedTasks.forEach((taskId) => {
        const task = manager.getTask(taskId);
        expect(task?.status).toBe('cancelled');
      });
    });
  });
});
