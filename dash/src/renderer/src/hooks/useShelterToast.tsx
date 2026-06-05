import { useEffect, useRef } from 'react';
import { useSignalStore } from '../store/signals';
import { pushToast, updateToast } from '../store/toasts';

// tcm_shelter_state enum from TCMShelterHeartbeat (0x210):
//   0 idle      — nothing in flight
//   1 claiming  — about to upload, parquet write happening
//   2 uploading — S3 multipart upload running
//   3 error     — last attempt failed; shelter will retry
const SHELTER_IDLE = 0;
const SHELTER_CLAIMING = 1;
const SHELTER_UPLOADING = 2;
const SHELTER_ERROR = 3;

const KEEP_CAR_ON = 'Do not power off the car';

// Inline lucide-style icons — sized to match the rich toast layout, all
// using currentColor so they inherit the toast's level palette.
const ICON_SVG_PROPS = {
  width: 56,
  height: 56,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function ShelterWarningIcon() {
  return (
    <svg {...ICON_SVG_PROPS}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

function ShelterDoneIcon() {
  return (
    <svg {...ICON_SVG_PROPS}>
      <path d="M21.801 10A10 10 0 1 1 17 3.335" />
      <path d="m9 11 3 3L22 4" />
    </svg>
  );
}

function ShelterErrorIcon() {
  return (
    <svg {...ICON_SVG_PROPS}>
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9-6 6" />
      <path d="m9 9 6 6" />
    </svg>
  );
}

function busyTitle(state: number): string {
  return state === SHELTER_CLAIMING
    ? 'Epic Shelter claiming batch'
    : 'Epic Shelter uploading batch';
}

// Watches tcm_shelter_state and shows a persistent rich warning while
// shelter is mid-upload so the driver doesn't kill power before the
// batch lands in S3. Morphs the title in place between claiming and
// uploading; on return to idle the toast flips to a plain "backup done"
// success (icon + body cleared, non-persistent so it TTLs out).
export function useShelterToast() {
  const state = useSignalStore((s) => s.signals['tcm_shelter_state']?.value);
  const toastIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (state === undefined) return;

    const isBusy = state === SHELTER_CLAIMING || state === SHELTER_UPLOADING;
    const id = toastIdRef.current;

    if (isBusy && !id) {
      toastIdRef.current = pushToast(busyTitle(state), {
        level: 'warn',
        persistent: true,
        body: KEEP_CAR_ON,
        icon: <ShelterWarningIcon />,
      });
    } else if (isBusy && id) {
      // Still busy, state moved (claiming → uploading or vice versa).
      updateToast(id, { message: busyTitle(state) });
    } else if (!isBusy && id) {
      if (state === SHELTER_ERROR) {
        updateToast(id, {
          message: 'Epic Shelter backup error',
          level: 'error',
          persistent: false,
          body: 'Will retry shortly',
          icon: <ShelterErrorIcon />,
        });
      } else if (state === SHELTER_IDLE) {
        updateToast(id, {
          message: 'Epic Shelter backup done',
          level: 'success',
          persistent: false,
          body: 'All data safely uploaded',
          icon: <ShelterDoneIcon />,
        });
      }
      toastIdRef.current = null;
    }
  }, [state]);
}
