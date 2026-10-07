"use client";
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "./Icon";
export function InviteQr({ url }: { url: string }) {
  const canvas = useRef<HTMLCanvasElement>(null),
    [png, setPng] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    setPng("");
    setError("");
    if (!canvas.current || !url) return;
    void QRCode.toCanvas(canvas.current, url, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 640,
      color: { dark: "#102820", light: "#ffffff" },
    })
      .then(() => {
        if (!stopped && canvas.current)
          setPng(canvas.current.toDataURL("image/png"));
      })
      .catch(() => {
        if (!stopped)
          setError(
            "This invite is too long for a QR code. Use Copy link instead.",
          );
      });
    return () => {
      stopped = true;
    };
  }, [url]);
  return (
    <section className="invite-qr">
      <div>
        <span className="eyebrow">SCAN TO JOIN</span>
        <h3>Your invite, as a QR code.</h3>
        <p>
          Scan with the phone camera, open the link, then connect a Canton
          wallet.
        </p>
        {png && (
          <a className="ui-button" download="vinss-invite-qr.png" href={png}>
            <Icon name="file" /> Download QR
          </a>
        )}
        {error && (
          <p role="alert" className="ui-alert error">
            {error}
          </p>
        )}
      </div>
      <div className="qr-code-wrap">
        <canvas
          ref={canvas}
          role="img"
          aria-label="QR code for this VINSS invitation"
          style={{ display: error ? "none" : undefined }}
        />
        {!png && !error && <span className="small muted">Preparing QR…</span>}
      </div>
    </section>
  );
}
