/** Sequencing only. AnimationMixer finished events (not wall-clock timers) advance poses. */
export class PostureState {
  posture: 'standing' | 'sitting' | 'seated' | 'standing-up' = 'standing'
  private recover = false
  sit() { if (this.posture !== 'standing') return false; this.posture = 'sitting'; return true }
  stand() {
    if (this.posture === 'sitting') { this.recover = true; return false }
    if (this.posture !== 'seated') return false
    this.posture = 'standing-up'; return true
  }
  seated() {
    if (this.posture !== 'sitting') return false
    this.posture = 'seated'
    if (this.recover) { this.recover = false; this.posture = 'standing-up' }
    return true
  }
  standing() { if (this.posture !== 'standing-up') return false; this.posture = 'standing'; return true }
}
