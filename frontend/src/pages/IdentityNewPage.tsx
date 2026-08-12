import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { writes } from "../lib/genlayer";
import { useProofMeshWrite } from "../features/contract/useProofMeshWrite";
import { WalletGate } from "../components/WalletPanel";
import { TransactionStatus } from "../components/TransactionStatus";
import { Breadcrumb, PageHead } from "../components/ui";

const PROFILE_ID_MAX = 100;
const VALID_ID = /^[A-Za-z0-9._-]+$/;

export default function IdentityNewPage() {
  const [profileId, setProfileId] = useState("");
  const [touched, setTouched] = useState(false);
  const write = useProofMeshWrite();
  const navigate = useNavigate();

  const trimmed = profileId.trim();
  const validationError = !trimmed
    ? "Choose an identifier for this profile."
    : trimmed.length > PROFILE_ID_MAX
      ? `Must be ${PROFILE_ID_MAX} characters or fewer.`
      : !VALID_ID.test(trimmed)
        ? "Use letters, numbers, dots, dashes, or underscores only."
        : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (validationError) return;

    const result = await write.execute((account) =>
      writes.createIdentityProfile(account, trimmed),
    );
    if (result.state === "finalized_success") {
      navigate(`/identity/${encodeURIComponent(trimmed)}/claims`);
    }
  }

  return (
    <div>
      <Breadcrumb items={[{ label: "Identity", to: "/identity" }, { label: "New profile" }]} />
      <PageHead eyebrow="Step 1 of the verification lifecycle" title="Create identity profile">
        <p>
          A profile is the on-chain record that your identity claims, proofs, and credentials
          hang off. It's owned by the wallet that creates it — only that wallet can add claims or
          submit proofs.
        </p>
      </PageHead>

      <div className="card" style={{ maxWidth: "38rem" }}>
        <WalletGate>
          <form onSubmit={handleSubmit} noValidate>
            <div className="field">
              <label htmlFor="profileId">Profile identifier</label>
              <input
                id="profileId"
                type="text"
                value={profileId}
                onChange={(e) => setProfileId(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="alex-dev"
                maxLength={PROFILE_ID_MAX + 20}
                aria-describedby="profileId-hint"
                aria-invalid={touched && validationError ? true : undefined}
                disabled={write.isPending}
              />
              <p className="field-hint" id="profileId-hint">
                A unique, public, human-readable ID. Cannot be changed later.
              </p>
              {touched && validationError && (
                <p className="field-error" role="alert">
                  {validationError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={write.isPending || Boolean(validationError)}
            >
              {write.isPending ? "Creating…" : "Create profile"}
            </button>
          </form>

          <TransactionStatus progress={write.progress} />

          {write.isError && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={write.reset}
              style={{ marginTop: "0.75rem" }}
            >
              Try again
            </button>
          )}
        </WalletGate>
      </div>

      <p className="note note-info" style={{ marginTop: "1.5rem", maxWidth: "38rem" }}>
        <strong>What happens next?</strong> After the profile is created you'll be taken to the
        Claim Wizard, where you add a public identity source and prove you control it.
      </p>
    </div>
  );
}
