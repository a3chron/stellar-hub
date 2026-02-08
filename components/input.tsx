// biome-ignore-all lint/a11y/noLabelWithoutControl: custom input label pattern
import { cn } from "@/lib/utils";

export default function Input({
  label,
  ...props
}: {
  label?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col">
      <span className="mb-1.5 text-sm">{label}</span>
      <InputField {...props} />
    </label>
  );
}

function InputField({
  className,
  ...props
}: { className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "p-2 rounded-lg bg-ctp-mantle border-2 border-ctp-crust text-text placeholder:text-subtext0 focus:outline-none focus:ring-2 focus:ring-ctp-surface0 ring-offset-2 ring-offset-ctp-base",
        className,
      )}
      {...props}
    />
  );
}
