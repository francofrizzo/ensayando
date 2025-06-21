# Lyrics Editor Refactoring Plan

## Status Overview

✅ **COMPLETED**: Split monolithic `useLyricsEditor.ts` into 5 focused composables (1161 → 850 lines)

✅ **COMPLETED**: Extract Position Management Utilities - Created `utils/lyricsPositionUtils.ts` with centralized position logic, eliminated ~60 lines of duplicated code across multiple composables, improved type safety with proper type guards

## High Priority Refactorings

### 1. **Extract Position Management Utilities** 🎯 _HIGH IMPACT_

**Status**: ✅ **COMPLETED**  
**Effort**: Medium (2-3 days)  
**Impact**: High - Eliminates duplication, improves testability

**Current Issue**: Position logic is duplicated across multiple composables with complex type guards

```typescript
// Repeated in useLyricsNavigation, useLyricsOperations
const { columnIndex, lineIndex } = currentFocus as FocusPosition & {
  columnIndex: number;
  lineIndex: number;
};
```

**Solution**: Create dedicated position utility functions

```typescript
// utils/lyricsPositionUtils.ts
export const isColumnContext = (position: FocusPosition): position is ColumnPosition => {
  return "columnIndex" in position && "lineIndex" in position;
};

export const validatePosition = (position: FocusPosition, lyrics: LyricStanza[]): boolean => {
  // Position validation logic
};

export const getItemAtPosition = (
  position: FocusPosition,
  lyrics: LyricStanza[]
): LyricVerse | LyricVerse[][] => {
  // Item retrieval logic
};

export const findNextValidPosition = (
  current: FocusPosition,
  direction: Direction
): FocusPosition | null => {
  // Next position calculation
};

export const calculatePositionAfterDeletion = (
  original: FocusPosition,
  lyrics: LyricStanza[]
): FocusPosition | null => {
  // Position adjustment after deletion
};

// Optional: Create a composable for position management
export const useLyricsPositionUtils = () => {
  return {
    isColumnContext,
    validatePosition,
    getItemAtPosition,
    findNextValidPosition,
    calculatePositionAfterDeletion
  };
};
```

**Benefits**:

- Eliminates ~60 lines of duplicated position logic
- Centralized validation and type safety
- Better testability of position operations
- Consistent position handling across all composables

### 2. **Improve Type Safety with Position Types** 🎯 _HIGH IMPACT_

**Status**: Not Started  
**Effort**: Small (1 day)  
**Impact**: High - Prevents runtime errors, better developer experience

**Current Issue**: Generic `FocusPosition` type causes type assertion complexity

```typescript
// Current: Unsafe type assertions everywhere
const { columnIndex, lineIndex } = currentFocus as FocusPosition & {
  columnIndex: number;
  lineIndex: number;
};
```

**Solution**: Create specific position types

```typescript
// types/LyricsPositions.ts
export interface BasePosition {
  stanzaIndex: number;
  itemIndex: number;
}

export interface RegularPosition extends BasePosition {}

export interface ColumnPosition extends BasePosition {
  columnIndex: number;
  lineIndex: number;
}

export type LyricsPosition = RegularPosition | ColumnPosition;

// Type guards
export function isColumnPosition(pos: LyricsPosition): pos is ColumnPosition {
  return "columnIndex" in pos && "lineIndex" in pos;
}
```

**Benefits**:

- Compile-time safety instead of runtime assertions
- Better IDE support and autocomplete
- Prevents entire classes of position-related bugs
- Cleaner, more readable code

### 3. **Add Comprehensive Unit Tests** 🎯 _HIGH IMPACT_

**Status**: Not Started  
**Effort**: Large (1-2 weeks)  
**Impact**: High - Ensures refactoring safety, prevents regressions

**Current Issue**: No unit tests for the complex lyrics editing logic

**Solution**: Create comprehensive test suites for each composable

```typescript
// tests/composables/useLyricsNavigation.test.ts
// tests/composables/useLyricsOperations.test.ts
// tests/composables/useLyricsTimestamps.test.ts
// tests/composables/useLyricsProperties.test.ts
// tests/composables/useLyricsCommands.test.ts
// tests/utils/lyricsPositionUtils.test.ts
// tests/utils/navigationStrategies.test.ts
// tests/utils/lyricsOperationFactories.test.ts
// tests/utils/verseUtils.test.ts
```

**Test Categories**:

- Position calculation and validation
- Navigation logic (up/down/left/right)
- CRUD operations (insert/delete/duplicate)
- Column operations and conversions
- Timestamp management
- Property inheritance and copying
- Edge cases and error conditions

**Benefits**:

- Safe refactoring with confidence
- Regression prevention
- Documentation through examples
- Easier onboarding for new developers

## Medium Priority Refactorings

### 4. **Simplify Navigation Logic with Functional Strategies** 🎯 _MEDIUM IMPACT_

**Status**: Not Started  
**Effort**: Medium (3-4 days)  
**Impact**: Medium - Cleaner architecture, easier to extend

**Current Issue**: Complex nested conditionals in navigation logic (100+ lines)

```typescript
// useLyricsNavigation.ts - Complex findNavigationPosition function
if (direction === "left" || direction === "right") {
  if (!isColumnContext(current)) return null;
  // ... 30+ lines of horizontal navigation logic
} else if (direction === "down") {
  // ... 40+ lines of vertical navigation logic
} else {
  // ... 30+ lines of up navigation logic
}
```

**Solution**: Functional navigation strategies

```typescript
// utils/navigationStrategies.ts
export type NavigationStrategy = (
  current: LyricsPosition,
  lyrics: LyricStanza[]
) => LyricsPosition | null;

export const createHorizontalNavigation = (direction: "left" | "right"): NavigationStrategy => {
  return (current: LyricsPosition, lyrics: LyricStanza[]) => {
    // Clean horizontal navigation logic
    return null; // placeholder
  };
};

export const createVerticalNavigation = (direction: "up" | "down"): NavigationStrategy => {
  return (current: LyricsPosition, lyrics: LyricStanza[]) => {
    // Clean vertical navigation logic
    return null; // placeholder
  };
};

// Navigation strategy factory
export const getNavigationStrategy = (direction: NavigationDirection): NavigationStrategy => {
  switch (direction) {
    case "left":
    case "right":
      return createHorizontalNavigation(direction);
    case "up":
    case "down":
      return createVerticalNavigation(direction);
    default:
      throw new Error(`Unknown navigation direction: ${direction}`);
  }
};

// Optional: Create a composable for navigation strategies
export const useNavigationStrategies = () => {
  const navigate = (
    direction: NavigationDirection,
    current: LyricsPosition,
    lyrics: LyricStanza[]
  ) => {
    const strategy = getNavigationStrategy(direction);
    return strategy(current, lyrics);
  };

  return { navigate, getNavigationStrategy };
};
```

**Benefits**:

- Cleaner, more focused navigation logic
- Easier to add new navigation modes (e.g., jump to timestamp)
- Better separation of concerns
- More testable individual functions
- Leverages Vue 3's reactivity system naturally

### 5. **Create Functional Operation Factories** 🎯 _MEDIUM IMPACT_

**Status**: Not Started  
**Effort**: Medium (2-3 days)  
**Impact**: Medium - Reduces duplication, consistent behavior

**Current Issue**: Similar patterns repeated across insert/delete operations

```typescript
// Repeated patterns in useLyricsOperations.ts
const newVerse: LyricVerse = { text: "", start_time: undefined, end_time: undefined };
// Insert logic...
updateLyrics(currentLyrics);
focusInput(newPosition);
```

**Solution**: Functional operation factories

```typescript
// utils/lyricsOperationFactories.ts
export type OperationType = "line" | "column" | "stanza";

export type InsertOperation = (
  position: LyricsPosition,
  lyrics: LyricStanza[],
  before?: boolean
) => { updatedLyrics: LyricStanza[]; newPosition: LyricsPosition };

export type DeleteOperation = (
  position: LyricsPosition,
  lyrics: LyricStanza[]
) => { updatedLyrics: LyricStanza[]; newPosition: LyricsPosition | null };

export const createInsertOperation = (type: OperationType): InsertOperation => {
  return (position: LyricsPosition, lyrics: LyricStanza[], before = false) => {
    // Unified insert logic with type-specific behavior
    switch (type) {
      case "line":
        return insertLine(position, lyrics, before);
      case "column":
        return insertColumn(position, lyrics, before);
      case "stanza":
        return insertStanza(position, lyrics, before);
    }
  };
};

export const createDeleteOperation = (type: OperationType): DeleteOperation => {
  return (position: LyricsPosition, lyrics: LyricStanza[]) => {
    // Unified delete logic with type-specific behavior
    switch (type) {
      case "line":
        return deleteLine(position, lyrics);
      case "column":
        return deleteColumn(position, lyrics);
      case "stanza":
        return deleteStanza(position, lyrics);
    }
  };
};

// Helper functions (to be implemented)
const insertLine = (position: LyricsPosition, lyrics: LyricStanza[], before: boolean) => {
  // Implementation details
  return { updatedLyrics: lyrics, newPosition: position };
};

const insertColumn = (position: LyricsPosition, lyrics: LyricStanza[], before: boolean) => {
  // Implementation details
  return { updatedLyrics: lyrics, newPosition: position };
};

const insertStanza = (position: LyricsPosition, lyrics: LyricStanza[], before: boolean) => {
  // Implementation details
  return { updatedLyrics: lyrics, newPosition: position };
};

const deleteLine = (position: LyricsPosition, lyrics: LyricStanza[]) => {
  // Implementation details
  return { updatedLyrics: lyrics, newPosition: position };
};

const deleteColumn = (position: LyricsPosition, lyrics: LyricStanza[]) => {
  // Implementation details
  return { updatedLyrics: lyrics, newPosition: position };
};

const deleteStanza = (position: LyricsPosition, lyrics: LyricStanza[]) => {
  // Implementation details
  return { updatedLyrics: lyrics, newPosition: position };
};

// Composable for operations
export const useLyricsOperationFactories = () => {
  const insertOperations = {
    line: createInsertOperation("line"),
    column: createInsertOperation("column"),
    stanza: createInsertOperation("stanza")
  };

  const deleteOperations = {
    line: createDeleteOperation("line"),
    column: createDeleteOperation("column"),
    stanza: createDeleteOperation("stanza")
  };

  return { insertOperations, deleteOperations };
};
```

**Benefits**:

- Eliminates ~80 lines of duplicate code
- Consistent operation behavior
- Easier to add new operation types
- Better error handling and validation
- Tree-shakable and composable architecture
- Works seamlessly with Vue 3's reactivity

### 6. **Performance Optimizations** 🎯 _MEDIUM IMPACT_

**Status**: Not Started  
**Effort**: Medium (2-3 days)  
**Impact**: Medium - Better user experience with large lyrics

**Current Issues**:

- Deep cloning of entire lyrics array on every change
- Unnecessary re-renders on focus changes
- Command registry recreated on every render

**Solutions**:

```typescript
// Optimize lyrics updates with structural sharing (Vue 3 composable)
export const useOptimizedLyricsUpdates = () => {
  const updateLyrics = (updater: (lyrics: LyricStanza[]) => LyricStanza[]) => {
    // Use immer or similar for efficient immutable updates
    // In Vue 3, we can use readonly/reactive patterns
    return updater;
  };

  return { updateLyrics };
};

// Memoize expensive computations (Vue 3 computed)
export const useNavigationMemo = (lyrics: Ref<LyricStanza[]>) => {
  const navigationGraph = computed(() => {
    return computeNavigationGraph(lyrics.value);
  });

  return { navigationGraph };
};

// Optimize command registry with Vue 3 patterns
export const useStableCommandRegistry = () => {
  const commandRegistry = readonly(createCommandRegistry());

  return { commandRegistry };
};

// Or use a provide/inject pattern for global command registry
export const COMMAND_REGISTRY_KEY = Symbol("commandRegistry");

export const provideCommandRegistry = () => {
  const registry = readonly(createCommandRegistry());
  provide(COMMAND_REGISTRY_KEY, registry);
  return registry;
};

export const useCommandRegistry = () => {
  const registry = inject(COMMAND_REGISTRY_KEY);
  if (!registry) {
    throw new Error("Command registry not provided");
  }
  return registry;
};
```

**Benefits**:

- Faster response times with large lyrics files
- Reduced memory usage through Vue 3's efficient reactivity
- Better user experience with smooth interactions
- Scalability for complex songs
- Leverages Vue 3's computed caching and shallow watching
- Tree-shaking eliminates unused performance utilities

## Low Priority Refactorings

### 7. **Extract Command Definitions to Configuration** 🎯 _LOW IMPACT_

**Status**: Not Started  
**Effort**: Small (1 day)  
**Impact**: Low - Better organization, easier customization

**Solution**: Move command definitions to external configuration

```typescript
// config/lyricsCommands.ts
export const lyricsCommandConfig: CommandConfig[] = [
  {
    id: "navigate-up",
    description: "Navegar hacia arriba",
    category: "Navegación",
    keybinding: { key: "ArrowUp" }
  }
  // ... other commands
];
```

### 8. **Create Functional Verse Utilities** 🎯 _LOW IMPACT_

**Status**: Not Started  
**Effort**: Small (1 day)  
**Impact**: Low - Consistency, slight reduction in duplication

**Solution**: Functional verse creation utilities

```typescript
// utils/verseUtils.ts
export const createEmptyVerse = (): LyricVerse => ({
  text: "",
  start_time: undefined,
  end_time: undefined
});

export const createVerseWithInheritance = (source: LyricVerse): LyricVerse => ({
  text: "",
  start_time: undefined,
  end_time: undefined,
  color_keys: source.color_keys ? [...source.color_keys] : undefined,
  audio_track_ids: source.audio_track_ids ? [...source.audio_track_ids] : undefined
});

export const cloneVerse = (verse: LyricVerse): LyricVerse => ({
  ...verse,
  color_keys: verse.color_keys ? [...verse.color_keys] : undefined,
  audio_track_ids: verse.audio_track_ids ? [...verse.audio_track_ids] : undefined
});

// Composable for verse operations
export const useVerseUtils = () => {
  return {
    createEmpty: createEmptyVerse,
    createWithInheritance: createVerseWithInheritance,
    clone: cloneVerse
  };
};

// Higher-order function for creating verse factories
export const createVerseFactory = (defaultProperties?: Partial<LyricVerse>) => {
  return (overrides?: Partial<LyricVerse>): LyricVerse => ({
    text: "",
    start_time: undefined,
    end_time: undefined,
    ...defaultProperties,
    ...overrides
  });
};
```

### 9. **Enhanced Command System** 🎯 _LOW IMPACT_

**Status**: Not Started  
**Effort**: Medium (2-3 days)  
**Impact**: Low - Better extensibility

**Solution**: More flexible command system

```typescript
// Enhanced command system with contexts, conditions, and macros
interface EnhancedCommand extends Command {
  contexts?: string[];
  condition?: (state: EditorState) => boolean;
  macro?: Command[];
}
```

## Implementation Timeline

### Phase 1: Foundation (Week 1-2)

1. **Position Management Utilities** - Establish solid functional foundation
2. **Type Safety Improvements** - Prevent bugs with strong typing
3. **Basic Unit Tests** - Safety net for further refactoring

### Phase 2: Architecture (Week 3-4)

4. **Functional Navigation Strategies** - Clean up complex logic with composables
5. **Functional Operation Factories** - Reduce duplication with pure functions
6. **Performance Optimizations** - Leverage Vue 3's reactivity optimizations

### Phase 3: Polish (Week 5)

7. **Command Configuration** - Better organization with functional approaches
8. **Functional Verse Utilities** - Final consistency improvements
9. **Enhanced Composable Command System** - Future extensibility with Vue 3 patterns

## Success Metrics

### Code Quality

- **Lines of Code**: Target 20% additional reduction (850 → ~680 lines)
- **Cyclomatic Complexity**: Reduce complex functions from 15+ to <10
- **Test Coverage**: Achieve 90%+ coverage on core logic
- **Type Safety**: Eliminate all type assertions

### Developer Experience

- **Build Time**: Maintain or improve current build performance with tree-shaking
- **IDE Support**: Better autocomplete and error detection with TypeScript composables
- **Onboarding**: New developers productive in <2 days with clear functional patterns
- **Debugging**: Clear error messages and stack traces with pure functions
- **Vue DevTools**: Better composable tracking and reactive debugging

### Runtime Performance

- **Large Files**: Handle 1000+ verse files smoothly
- **Memory Usage**: Reduce memory footprint by 30%
- **Response Time**: <50ms for all user interactions
- **Bundle Size**: No significant increase in bundle size

## Risk Mitigation

### High Risk Items

- **Position Management Refactoring**: Could break existing navigation
  - _Mitigation_: Comprehensive tests before and after changes
- **Type System Changes**: Could cause compilation errors
  - _Mitigation_: Gradual migration with temporary compatibility layer

### Medium Risk Items

- **Performance Optimizations**: Could introduce subtle bugs
  - _Mitigation_: A/B testing with performance monitoring
- **Navigation Strategy Pattern**: Complex logic changes
  - _Mitigation_: Feature flags for gradual rollout

## Functional Approach Benefits

This refactoring plan embraces **functional programming** and **Vue 3 composables** over class-based patterns for several key reasons:

### ✅ **Composability**

- Functions can be easily composed and reused across different composables
- Pure functions are predictable and testable in isolation
- Vue 3's composition API works naturally with functional patterns

### ✅ **Tree-Shaking**

- Unused utility functions are eliminated during build
- Smaller bundle sizes compared to class-based approaches
- Better performance for end users

### ✅ **TypeScript Integration**

- Function signatures provide clear contracts
- Type inference works better with functional patterns
- Less boilerplate than class-based type definitions

### ✅ **Vue 3 Reactivity**

- Composables integrate seamlessly with Vue's reactivity system
- `computed`, `watch`, and `ref` work naturally with functional utilities
- Better performance through selective reactivity

### ✅ **Testing & Debugging**

- Pure functions are easier to unit test
- No complex class hierarchies or state management
- Clear input/output contracts for all utilities

---

This plan prioritizes high-impact improvements that build on the successful modular foundation already established, ensuring continued maintainability and developer productivity while embracing modern Vue 3 and functional programming best practices.
