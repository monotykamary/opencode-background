import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BackgroundProcessManager } from './BackgroundProcessManager';
import { EventEmitter } from 'events';

const mockSendIgnoredMessage = vi.fn().mockResolvedValue(undefined);

vi.mock('./notifications', () => ({
  sendIgnoredMessage: mockSendIgnoredMessage,
}));

class MockSubprocess extends EventEmitter {
  pid: number;
  stdout: EventEmitter;
  stderr: EventEmitter;
  private shouldReject: boolean = false;
  private rejectMsg: string = '';

  constructor(reject = false, rejectMsg = '') {
    super();
    this.pid = Math.floor(Math.random() * 1000000);
    this.stdout = new EventEmitter();
    this.stderr = new EventEmitter();
    this.shouldReject = reject;
    this.rejectMsg = rejectMsg;
  }

  then(resolveCallback: () => void) {
    if (!this.shouldReject) {
      process.nextTick(() => {
        if (resolveCallback) resolveCallback();
      });
    }
    return this;
  }

  // eslint-disable-next-line no-unused-vars
  catch(callback: (err: Error) => void) {
    if (this.shouldReject) {
      process.nextTick(() => {
        if (callback) callback(new Error(this.rejectMsg));
      });
    }
    return this;
  }

  kill() {
    return true;
  }
}

let mockReject = false;
let mockRejectMsg = '';

vi.mock('execa', () => ({
  execa: vi.fn(() => {
    const mockSubprocess = new MockSubprocess(mockReject, mockRejectMsg);
    (mockSubprocess as unknown as { kill: unknown }).kill = vi.fn();
    return mockSubprocess;
  }),
}));

vi.mock('process', () => ({
  kill: vi.fn(() => true),
}));

describe('BackgroundProcessManager', () => {
  let taskManager: BackgroundProcessManager;
  let mockClient: any;

  beforeEach(() => {
    mockReject = false;
    mockRejectMsg = '';
    mockClient = { session: { prompt: vi.fn() } };
    taskManager = new BackgroundProcessManager(mockClient);
    mockSendIgnoredMessage.mockClear();
  });

  describe('Task Creation', () => {
    it('should log task details when all parameters are provided', () => {
      const taskId = taskManager.createTask({
        command: 'echo hello',
        name: 'Test Task',
        tags: ['test'],
        global: true,
        sessionId: 'test-session',
      });

      const task = JSON.parse(taskManager.getTask(taskId));

      expect(task.global).toBe(true);
    });

    it('should have global as false when not explicitly set', () => {
      const taskId = taskManager.createTask({
        command: 'echo hello',
        name: 'Test Task',
      });

      const task = JSON.parse(taskManager.getTask(taskId));

      expect(task.global).toBe(false);
    });
  });

  describe('Task Termination', () => {
    it('should kill a specific task by id', () => {
      const spy = vi.spyOn(process, 'kill');
      spy.mockImplementation(() => true);

      const taskId = taskManager.createTask({
        command: 'echo hello',
        global: true,
        sessionId: 'test-session',
      });

      const killedTasks = JSON.parse(taskManager.killTasks({ taskId })) as string[];
      expect(killedTasks.length).toBe(1);
      expect(killedTasks[0]).toBe(taskId);
      expect(spy).toHaveBeenCalled();

      const task = JSON.parse(taskManager.getTask(taskId));
      expect(task.status).toBe('cancelled');
      expect(task.outputStream).toContain('Task forcibly terminated');
    });
  });

  describe('Notifications', () => {
    it('should send notification when task completes successfully', async () => {
      const taskId = taskManager.createTask({
        command: 'echo hello',
        name: 'Test Task',
        sessionId: 'session-123',
      });

      // eslint-disable-next-line no-undef
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSendIgnoredMessage).toHaveBeenCalledWith(
        mockClient,
        'session-123',
        expect.stringContaining('[Background Task Completed]')
      );
      expect(mockSendIgnoredMessage).toHaveBeenCalledWith(
        mockClient,
        'session-123',
        expect.stringContaining('Test Task')
      );
      expect(mockSendIgnoredMessage).toHaveBeenCalledWith(
        mockClient,
        'session-123',
        expect.stringContaining(taskId)
      );
    });

    it('should send notification with command name when task name is not provided', async () => {
      taskManager.createTask({
        command: 'ls -la',
        sessionId: 'session-000',
      });

      // eslint-disable-next-line no-undef
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSendIgnoredMessage).toHaveBeenCalledWith(
        mockClient,
        'session-000',
        expect.stringContaining('ls -la')
      );
    });

    it('should send notification when task fails', async () => {
      mockReject = true;
      mockRejectMsg = 'Exit code 127: command not found';

      const taskId = taskManager.createTask({
        command: 'invalid-cmd',
        name: 'Failing Task',
        sessionId: 'session-456',
      });

      // eslint-disable-next-line no-undef
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockSendIgnoredMessage).toHaveBeenCalledWith(
        mockClient,
        'session-456',
        expect.stringContaining('[Background Task Failed]')
      );
      expect(mockSendIgnoredMessage).toHaveBeenCalledWith(
        mockClient,
        'session-456',
        expect.stringContaining('Failing Task')
      );
      expect(mockSendIgnoredMessage).toHaveBeenCalledWith(
        mockClient,
        'session-456',
        expect.stringContaining(taskId)
      );
      expect(mockSendIgnoredMessage).toHaveBeenCalledWith(
        mockClient,
        'session-456',
        expect.stringContaining('Exit code 127: command not found')
      );
    });

    it('should include error output in failure notification', async () => {
      mockReject = true;
      mockRejectMsg = 'Build failed';

      taskManager.createTask({
        command: 'npm run build',
        name: 'Build Task',
        sessionId: 'session-789',
      });

      // eslint-disable-next-line no-undef
      await new Promise((resolve) => setTimeout(resolve, 10));

      const callArgs = mockSendIgnoredMessage.mock.calls[0];
      expect(callArgs[2]).toContain('[Background Task Failed]');
      expect(callArgs[2]).toContain('Error: Build failed');
    });
  });
});
