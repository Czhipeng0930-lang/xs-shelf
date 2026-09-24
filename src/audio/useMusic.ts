import { useEffect } from 'react';
import { chiptune } from './chiptune';
import { TRACKS, type TrackId } from './tracks';

/**
 * 按当前场景播放对应 BGM。
 * 浏览器要求先有用户手势，所以第一次交互后才真正出声。
 */
export function useMusic(trackId: TrackId, enabled: boolean) {
  useEffect(() => {
    if (!enabled) {
      try {
        chiptune.stop();
      } catch {
        /* 音频节点状态异常时忽略 */
      }
      return;
    }
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      try {
        chiptune.play(TRACKS[trackId]);
      } catch {
        started = false;
      }
    };
    start();
    // 没拿到音频权限时，等第一次点击/按键再补一次
    window.addEventListener('pointerdown', start, { once: true });
    window.addEventListener('keydown', start, { once: true });
    return () => {
      window.removeEventListener('pointerdown', start);
      window.removeEventListener('keydown', start);
    };
  }, [trackId, enabled]);

  // 切后台静音，回前台恢复
  useEffect(() => {
    const onVis = () => {
      try {
        if (document.hidden) chiptune.stop();
        else if (enabled) chiptune.play(TRACKS[trackId]);
      } catch {
        /* 切后台时音频上下文可能已挂 */
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [trackId, enabled]);
}
