"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Icon } from "./Icon";
export function InviteQr({ url }: { url: string }) {
  const [png, setPng] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let stopped = false;
    setPng("");
    setError("");
    if (!url) return;
    void QRCode.toDataURL(url, {
      errorCorrectionLevel: "M",
      margin: 4,
      width: 640,
      color: { dark: "#102820", light: "#ffffff" },
    })
      .then((dataUrl) => {
        if (!stopped) setPng(dataUrl);
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
        {png && (
          <img
            src={png}
            width={640}
            height={640}
            alt="QR code for this VINSS invitation"
          />
        )}
        {!png && !error && <span className="small muted">Preparing QR…</span>}
      </div>
    </section>
  );
}
