import { computed, inject, provide, type ComputedRef, type InjectionKey, type Ref } from "vue";

export interface PlayerState {
  currentTime: Ref<number>;
  totalDuration: Ref<number>;
  isPlaying: Ref<boolean>;
  isReady: ComputedRef<boolean>;
}

const PLAYER_STATE_KEY: InjectionKey<PlayerState> = Symbol("player-state");

export function providePlayerState(state: PlayerState) {
  provide(PLAYER_STATE_KEY, state);
}

export function usePlayerState() {
  const playerTime = inject(PLAYER_STATE_KEY);

  if (!playerTime) {
    // Return default values when not in player context
    return {
      currentTime: computed(() => 0),
      totalDuration: computed(() => 0),
      isPlaying: computed(() => false),
      isReady: computed(() => false)
    };
  }

  return {
    currentTime: computed(() => playerTime.currentTime.value),
    totalDuration: computed(() => playerTime.totalDuration.value),
    isPlaying: computed(() => playerTime.isPlaying.value),
    isReady: computed(() => playerTime.isReady.value)
  };
}
