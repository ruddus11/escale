import { useState, type FormEvent, type ReactNode } from "react";
import { readAccessToken, saveAccessToken } from "../../services/accessToken";

export interface AccessGateContext {
  accessToken: string;
  onUnauthorized: () => void;
}

interface AccessGateProps {
  children: ReactNode | ((context: AccessGateContext) => ReactNode);
}

export function AccessGate({ children }: AccessGateProps) {
  const [accessToken, setAccessToken] = useState<string | null>(() =>
    readAccessToken(),
  );
  const [draft, setDraft] = useState("");
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );

  const handleUnauthorized = () => {
    setDraft(accessToken ?? readAccessToken() ?? "");
    setAccessToken(null);
    setValidationMessage(
      "저장된 접근 코드가 서버 코드와 일치하지 않습니다. 확인하거나 수정한 뒤 다시 시도하세요.",
    );
  };

  const handleEdit = () => {
    setDraft(accessToken ?? readAccessToken() ?? "");
    setAccessToken(null);
    setValidationMessage(null);
  };

  if (accessToken !== null) {
    return (
      <>
        <button
          className="transit-page__access-edit"
          type="button"
          onClick={handleEdit}
        >
          접근 코드 변경
        </button>
        {typeof children === "function"
          ? children({ accessToken, onUnauthorized: handleUnauthorized })
          : children}
      </>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const submittedToken = draft.trim();
    if (submittedToken.length === 0) {
      setValidationMessage("접근 코드를 입력하세요.");
      return;
    }

    saveAccessToken(submittedToken);
    setDraft("");
    setValidationMessage(null);
    setAccessToken(submittedToken);
  };

  return (
    <section className="access-gate" aria-labelledby="access-gate-title">
      <span className="access-gate__eyebrow">개인 교통 조회</span>
      <h2 id="access-gate-title">교통편 잠금 해제</h2>
      <p>접근 코드는 이 기기에만 저장되며 다음에도 자동으로 입력됩니다.</p>
      <form onSubmit={handleSubmit}>
        <label htmlFor="transit-access-token">개인 접근 코드</label>
        <input
          id="transit-access-token"
          type="password"
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          aria-describedby={
            validationMessage === null ? undefined : "access-gate-message"
          }
        />
        {validationMessage === null ? null : (
          <p id="access-gate-message" role="status">
            {validationMessage}
          </p>
        )}
        <button type="submit">교통편 잠금 해제</button>
      </form>
    </section>
  );
}
