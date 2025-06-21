# Lyrics Editor Refactoring Plan

## Status Overview

✅ **COMPLETED**: Split monolithic `useLyricsEditor.ts` into 5 focused composables (1161 → 850 lines)

## High Priority Refactorings

### 1. **Extract Position Management Utilities** 🎯 _HIGH IMPACT_

**Status**: Not Started  
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

**Solution**: Create dedicated position utility class

```typescript
// utils/LyricsPositionManager.ts
export class LyricsPositionManager {
  static isColumnContext(position: FocusPosition): position is ColumnPosition;
  static validatePosition(position: FocusPosition, lyrics: LyricStanza[]): boolean;
  static getItemAtPosition(
    position: FocusPosition,
    lyrics: LyricStanza[]
  ): LyricVerse | LyricVerse[][];
  static findNextValidPosition(current: FocusPosition, direction: Direction): FocusPosition | null;
  static calculatePositionAfterDeletion(
    original: FocusPosition,
    lyrics: LyricStanza[]
  ): FocusPosition | null;
}
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
// tests/utils/LyricsPositionManager.test.ts
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

### 4. **Simplify Navigation Logic with Strategy Pattern** 🎯 _MEDIUM IMPACT_

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

**Solution**: Strategy pattern for navigation

```typescript
// strategies/NavigationStrategies.ts
interface NavigationStrategy {
  findNext(current: LyricsPosition, lyrics: LyricStanza[]): LyricsPosition | null;
}

class HorizontalNavigationStrategy implements NavigationStrategy {
  constructor(private direction: "left" | "right") {}
  findNext(current: LyricsPosition, lyrics: LyricStanza[]): LyricsPosition | null {
    // Clean horizontal navigation logic
  }
}

class VerticalNavigationStrategy implements NavigationStrategy {
  constructor(private direction: "up" | "down") {}
  findNext(current: LyricsPosition, lyrics: LyricStanza[]): LyricsPosition | null {
    // Clean vertical navigation logic
  }
}
```

**Benefits**:

- Cleaner, more focused navigation logic
- Easier to add new navigation modes (e.g., jump to timestamp)
- Better separation of concerns
- More testable individual strategies

### 5. **Create Operation Factories** 🎯 _MEDIUM IMPACT_

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

**Solution**: Operation factory pattern

```typescript
// factories/LyricsOperationFactory.ts
export class LyricsOperationFactory {
  static createInsertOperation(type: "line" | "column" | "stanza") {
    return (position: LyricsPosition, before: boolean = false) => {
      // Unified insert logic with type-specific behavior
    };
  }

  static createDeleteOperation(type: "line" | "column" | "stanza") {
    return (position: LyricsPosition) => {
      // Unified delete logic with type-specific behavior
    };
  }
}
```

**Benefits**:

- Eliminates ~80 lines of duplicate code
- Consistent operation behavior
- Easier to add new operation types
- Better error handling and validation

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
// Optimize lyrics updates with structural sharing
const optimizedUpdateLyrics = useCallback((updater: (lyrics: LyricStanza[]) => void) => {
  // Use immer or similar for efficient immutable updates
}, []);

// Memoize expensive computations
const memoizedNavigation = useMemo(() => {
  return computeNavigationGraph(lyrics.value);
}, [lyrics.value]);

// Optimize command registry
const stableCommandRegistry = useMemo(() => createCommandRegistry(), []);
```

**Benefits**:

- Faster response times with large lyrics files
- Reduced memory usage
- Better user experience
- Scalability for complex songs

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

### 8. **Create Verse Factory Utilities** 🎯 _LOW IMPACT_

**Status**: Not Started  
**Effort**: Small (1 day)  
**Impact**: Low - Consistency, slight reduction in duplication

**Solution**: Centralized verse creation

```typescript
// utils/VerseFactory.ts
export class VerseFactory {
  static createEmpty(): LyricVerse {
    return { text: "", start_time: undefined, end_time: undefined };
  }

  static createWithInheritance(source: LyricVerse): LyricVerse {
    return {
      text: "",
      start_time: undefined,
      end_time: undefined,
      color_keys: source.color_keys ? [...source.color_keys] : undefined,
      audio_track_ids: source.audio_track_ids ? [...source.audio_track_ids] : undefined
    };
  }
}
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

1. **Position Management Utilities** - Establish solid foundation
2. **Type Safety Improvements** - Prevent bugs early
3. **Basic Unit Tests** - Safety net for further refactoring

### Phase 2: Architecture (Week 3-4)

4. **Navigation Strategy Pattern** - Clean up complex logic
5. **Operation Factories** - Reduce duplication
6. **Performance Optimizations** - Improve user experience

### Phase 3: Polish (Week 5)

7. **Command Configuration** - Better organization
8. **Verse Factory** - Final consistency improvements
9. **Enhanced Command System** - Future extensibility

## Success Metrics

### Code Quality

- **Lines of Code**: Target 20% additional reduction (850 → ~680 lines)
- **Cyclomatic Complexity**: Reduce complex functions from 15+ to <10
- **Test Coverage**: Achieve 90%+ coverage on core logic
- **Type Safety**: Eliminate all type assertions

### Developer Experience

- **Build Time**: Maintain or improve current build performance
- **IDE Support**: Better autocomplete and error detection
- **Onboarding**: New developers productive in <2 days
- **Debugging**: Clear error messages and stack traces

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

This plan prioritizes high-impact improvements that build on the successful modular foundation already established, ensuring continued maintainability and developer productivity.
