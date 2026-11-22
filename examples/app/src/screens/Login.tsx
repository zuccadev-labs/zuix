import { useState } from "react";
import { AuthLayout, Page } from "@zuccadev-labs/zuix-zout";
import { Button, Checkbox, Divider, Field, Input, PasswordInput } from "@zuccadev-labs/zuix-zui";

export function LoginScreen() {
  const [variant, setVariant] = useState<"centered" | "split">("centered");
  const [sent, setSent] = useState("");
  return (
    <Page label="Sign in" width="full">
      <div className="app-auth" data-testid="auth">
        <AuthLayout
          variant={variant}
          brand={
            <>
              <span className="app-brand-mark" aria-hidden="true" />
              Acme
            </>
          }
          title="Welcome back"
          description="Sign in to continue to your workspace."
          media={<div className="app-auth-media" />}
          footer={
            <>
              No account? <a href="#signup">Create one</a>
            </>
          }
          legal={
            <>
              <a href="#terms">Terms</a>
              <a href="#privacy">Privacy</a>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setVariant(variant === "centered" ? "split" : "centered")}
                data-testid="auth-variant"
              >
                {variant === "centered" ? "Split layout" : "Centered layout"}
              </Button>
            </>
          }
        >
          <form
            className="app-auth-form"
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              setSent(String(data.get("email") ?? ""));
            }}
          >
            <Button type="button" icon="finger-print" fullWidth>
              Sign in with a passkey
            </Button>
            <Divider>or</Divider>
            <Field label="Email">
              <Input name="email" type="email" autoComplete="email webauthn" required data-testid="auth-email" />
            </Field>
            <Field label="Password">
              <PasswordInput name="password" autoComplete="current-password" required />
            </Field>
            <div className="app-auth-row">
              <Checkbox name="remember">Keep me signed in</Checkbox>
              <a href="#reset">Forgot password?</a>
            </div>
            <Button type="submit" variant="primary" fullWidth data-testid="auth-submit">
              Sign in
            </Button>
            <p className="app-muted" role="status" data-testid="auth-sent">
              {sent ? `Signing in as ${sent}` : ""}
            </p>
          </form>
        </AuthLayout>
      </div>
    </Page>
  );
}
