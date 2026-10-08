import { useState, type FormEvent } from "react";
import Button from "../ui/Button.tsx";
import { toErrorMessage } from "../errors/errorMessage.ts";
import { createPopupInputValues, validatePopupInputValues } from "./inputModel.ts";
import PopupFrame from "./PopupFrame.tsx";
import type { InputPopupOptions, PopupInputValues } from "./types.ts";
import styles from "./PopupContent.module.css";

interface Props {
  readonly options: InputPopupOptions;
  readonly onResolve: (values: PopupInputValues) => void;
  readonly onCancel: () => void;
}

export default function InputPopup({ options, onResolve, onCancel }: Props) {
  const [values, setValues] = useState<PopupInputValues>(() => createPopupInputValues(options.fields));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const allowCancel = options.allowCancel ?? true;

  const clearValues = (): void => setValues(createPopupInputValues(options.fields));
  const submit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (busy) return;
    const fieldError = validatePopupInputValues(options.fields, values);
    const formError = fieldError ?? options.validate?.(values) ?? null;
    if (formError) {
      setError(formError);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const submitError = await options.onConfirm?.(values) ?? null;
      if (submitError) {
        if (options.clearOnError) clearValues();
        setError(submitError);
        return;
      }
      onResolve(values);
    } catch (value: unknown) {
      if (options.clearOnError) clearValues();
      setError(toErrorMessage(value, "입력 내용을 처리하지 못했습니다."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PopupFrame options={options} onDismiss={busy || !allowCancel ? undefined : onCancel}>
      <form className={styles.body} onSubmit={(event) => void submit(event)}>
        <div className={styles.fields}>{options.fields.map((field, index) => {
          const shared = {
            name: field.name,
            placeholder: field.placeholder,
            maxLength: field.maxLength,
            required: field.required ?? true,
            value: values[field.name] ?? "",
            disabled: busy,
            "data-popup-autofocus": field.autoFocus || (!options.fields.some((item) => item.autoFocus) && index === 0) ? "true" : undefined,
          };
          const update = (value: string): void => setValues((current) => ({ ...current, [field.name]: value }));
          return <label className={styles.field} key={field.name}>
            {field.label}
            {field.multiline
              ? <textarea {...shared} rows={8} onChange={(event) => update(event.target.value)} />
              : <input {...shared} type={field.type ?? "text"} inputMode={field.inputMode} autoComplete={field.autoComplete} pattern={field.pattern} onChange={(event) => update(event.target.value)} />}
          </label>;
        })}</div>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <div className={styles.actions}>
          {allowCancel ? <Button variant="ghost" onClick={onCancel} disabled={busy}>{options.cancelLabel ?? "취소"}</Button> : null}
          <Button type="submit" disabled={busy}>{busy ? "처리 중…" : options.confirmLabel ?? "확인"}</Button>
        </div>
      </form>
    </PopupFrame>
  );
}
