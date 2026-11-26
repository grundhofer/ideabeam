import { useId } from "react";
import { Icon } from "../sebaro/react/Icon";

type Props<T extends string> = {
  /** what is chosen: the legend of the group */
  legend: string;
  /** the legend is heard, not shown: what stands right above the control says it already */
  quiet?: boolean;
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange(value: T): void;
};

/** A segmented control: two to four short options of which one is chosen, side by side in one frame. The copy
 *  brings its styles and no React part for it (docs/sebaro-luecken.md); the markup is the one of sebaro's demo:
 *  radio buttons, so the arrow keys move the choice. */
export function Segmented<T extends string>({ legend, quiet, options, value, onChange }: Props<T>) {
  const name = useId();
  return (
    <fieldset className="sb-segmented">
      <legend className={quiet ? "sb-visually-hidden" : undefined}>{legend}</legend>
      <div className="sb-segmented__options">
        {options.map((option) => (
          <label key={option.value} className="sb-segmented__option">
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              onChange={() => onChange(option.value)}
            />
            <span className="sb-segmented__face">
              <Icon name="check--16" size={16} />
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
