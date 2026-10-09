"use client";
import { useEffect, useId, useRef, useState } from "react";
import { installDevNetApproval, type DevNetApproval } from "@/lib/devnet-wallet";

type Pending = DevNetApproval & { resolve(approved: boolean): void };
export function DevNetTransactionApproval() {
  const [pending, setPending] = useState<Pending>();
  const queue = useRef<Pending[]>([]), current = useRef<Pending | undefined>(undefined);
  const dialog = useRef<HTMLDialogElement>(null), title = useId();
  function advance() { current.current = queue.current.shift(); setPending(current.current); }
  function finish(approved: boolean) { current.current?.resolve(approved); advance(); }
  useEffect(() => {
    const remove = installDevNetApproval(input => new Promise(resolve => {
      queue.current.push({ ...input, resolve });
      if (!current.current) advance();
    }));
    return () => {
      remove(); current.current?.resolve(false); current.current = undefined;
      for (const item of queue.current.splice(0)) item.resolve(false);
    };
  }, []);
  useEffect(() => {
    const element = dialog.current;
    if (pending && element && !element.open) element.showModal();
    if (!pending && element?.open) element.close();
  }, [pending]);
  return <dialog ref={dialog} className="wallet-dialog" aria-labelledby={title} onCancel={event => { event.preventDefault(); finish(false); }}>
    <h2 id={title}>Approve DevNet transaction</h2>
    {pending && <div className="stack">
      <p className="wallet-dialog-description">NODERS will submit this transaction for your sandbox Party.</p>
      <p className="mono break-word">{pending.partyId}</p>
      <p>{pending.params.commands.length} command(s)</p>
      <ul>{pending.params.commands.map((command, index) => {
        const value = command as unknown as Record<string, { templateId?: string; choice?: string }>;
        const action = value.ExerciseCommand || value.CreateCommand;
        return <li key={index} className="break-word">{action?.choice || "Create contract"} · {action?.templateId?.split(":").pop() || "Daml contract"}</li>;
      })}</ul>
      <details><summary>Review commands</summary><pre className="devnet-commands">{JSON.stringify(pending.params, null, 2)}</pre></details>
      <button type="button" className="ui-button primary" onClick={() => finish(true)}>Approve transaction</button>
      <button type="button" className="ui-button" autoFocus onClick={() => finish(false)}>Reject</button>
    </div>}
  </dialog>;
}
