import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import config from "../../capacitor.config";

afterEach(cleanup);

function TextFields() {
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  return <>
    <Input aria-label="name" value={name} onChange={(event) => setName(event.target.value)} />
    <Textarea aria-label="note" value={note} onChange={(event) => setNote(event.target.value)} />
  </>;
}

describe("Hindi input regression", () => {
  it("uses WebView's native input connection instead of key-event capture", () => {
    expect(config.android?.captureInput).toBe(false);
  });

  it.each(["रामलाल शर्मा", "श्री श्याम कंस्ट्रक्शन", "ग्राम झुंझुनूँ, राजस्थान", "किराए के लिए एडवांस", "जुलाई की मजदूरी", "क्ष त्र ज्ञ श्र कि की कृ ँ ं"])("preserves Unicode input: %s", (value) => {
    render(<TextFields />);
    for (const label of ["name", "note"]) {
      const field = screen.getByLabelText(label);
      fireEvent.change(field, { target: { value } });
      expect(field).toHaveValue(value);
    }
  });

  it("does not discard intermediate composition or the final committed text", () => {
    render(<TextFields />);
    for (const label of ["name", "note"]) {
      const field = screen.getByLabelText(label);
      fireEvent.compositionStart(field);
      fireEvent.change(field, { target: { value: "क्" } });
      fireEvent.compositionUpdate(field, { data: "क्" });
      expect(field).toHaveValue("क्");
      fireEvent.change(field, { target: { value: "क्षेत्र" } });
      fireEvent.compositionEnd(field, { data: "क्षेत्र" });
      expect(field).toHaveValue("क्षेत्र");
    }
  });
});