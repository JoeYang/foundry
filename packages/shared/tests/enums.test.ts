import { describe, it, expect } from 'vitest';
import {
  projectStatusSchema,
  todoStatusSchema,
  projectEventKindSchema,
  actorSchema,
  PROJECT_STATUSES,
  TODO_STATUSES,
  PROJECT_EVENT_KINDS,
} from '../src/enums.js';

describe('projectStatusSchema', () => {
  it.each(PROJECT_STATUSES)('accepts %s', (s) => {
    expect(projectStatusSchema.parse(s)).toBe(s);
  });
  it('rejects unknown values', () => {
    expect(() => projectStatusSchema.parse('archived')).toThrow();
    expect(() => projectStatusSchema.parse('')).toThrow();
    expect(() => projectStatusSchema.parse(null)).toThrow();
  });
});

describe('todoStatusSchema', () => {
  it.each(TODO_STATUSES)('accepts %s', (s) => {
    expect(todoStatusSchema.parse(s)).toBe(s);
  });
  it('rejects unknown values', () => {
    expect(() => todoStatusSchema.parse('todo')).toThrow();
    expect(() => todoStatusSchema.parse('')).toThrow();
    expect(() => todoStatusSchema.parse(null)).toThrow();
  });
});

describe('projectEventKindSchema', () => {
  it.each(PROJECT_EVENT_KINDS)('accepts %s', (k) => {
    expect(projectEventKindSchema.parse(k)).toBe(k);
  });
  it('rejects unknown kinds', () => {
    expect(() => projectEventKindSchema.parse('todo_added')).toThrow();
    expect(() => projectEventKindSchema.parse('')).toThrow();
    expect(() => projectEventKindSchema.parse(null)).toThrow();
  });
});

describe('actorSchema', () => {
  it.each([
    'agent:claude-opus-4-7',
    'agent:claude-sonnet-4-6',
    'agent:claude-code',
    'agent:custom-cli',
    'human:joeyang',
  ])('accepts %s', (a) => {
    expect(actorSchema.parse(a)).toBe(a);
  });
  it('requires agent: or human: prefix', () => {
    expect(() => actorSchema.parse('claude')).toThrow();
    expect(() => actorSchema.parse('bot:x')).toThrow();
    expect(() => actorSchema.parse('agent:')).toThrow();
    expect(() => actorSchema.parse('human:')).toThrow();
  });
});
