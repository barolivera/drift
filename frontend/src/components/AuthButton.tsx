import { usePrivy } from '@privy-io/react-auth';

function short(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

/** Right-hand side of the nav: two pills, the solid one is coral. */
export function AuthButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) return <span className="pixel text-mute">…</span>;

  if (!authenticated) {
    return (
      <button onClick={login} className="btn-primary btn-sm">
        Log in
      </button>
    );
  }

  const label = user?.email?.address ?? (user?.wallet?.address ? short(user.wallet.address) : 'Account');
  return (
    <div className="flex items-center gap-3">
      <span className="pixel hidden text-mute md:inline" title={label}>
        {label.length > 22 ? label.slice(0, 20) + '…' : label}
      </span>
      <button onClick={logout} className="btn-secondary btn-sm">
        Log out
      </button>
    </div>
  );
}
