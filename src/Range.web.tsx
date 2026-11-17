import React, { useEffect, useState } from "react";
import type { SliderProps } from "@react-native-community/slider";
/** Use the browser's keyboard-accessible range control in the preview. */
export default function Range(props: SliderProps) {
  const [value, setValue] = useState(props.value || 0);
  useEffect(() => setValue(props.value || 0), [props.value]);
  return (
    <input
      type="range"
      aria-label={props.accessibilityLabel}
      min={props.minimumValue ?? 0}
      max={props.maximumValue ?? 1}
      step={props.step || "any"}
      value={value}
      disabled={props.disabled}
      style={{
        width: "100%",
        height: 28,
        margin: 0,
        accentColor: props.minimumTrackTintColor || "#8861CC",
        cursor: "pointer",
      }}
      onChange={(event) => {
        const next = Number(event.currentTarget.value);
        setValue(next);
        props.onValueChange?.(next);
      }}
      onPointerUp={(event) =>
        props.onSlidingComplete?.(Number(event.currentTarget.value))
      }
      onKeyUp={(event) => {
        if (
          [
            "ArrowLeft",
            "ArrowRight",
            "ArrowUp",
            "ArrowDown",
            "Home",
            "End",
            "PageUp",
            "PageDown",
          ].includes(event.key)
        )
          props.onSlidingComplete?.(Number(event.currentTarget.value));
      }}
    />
  );
}
