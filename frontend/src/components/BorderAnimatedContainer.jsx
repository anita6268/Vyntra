function BorderAnimatedContainer({ children }) {
  return (
    <div className="flex h-full min-h-0 w-full overflow-hidden rounded-[30px] border border-white/10 bg-[color:var(--panel)]/80 shadow-[0_30px_120px_rgba(0,0,0,0.45)] backdrop-blur-2xl">
      {children}
    </div>
  );
}
export default BorderAnimatedContainer;
