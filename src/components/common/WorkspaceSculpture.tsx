/** Decorative CSS sculpture: no canvas, downloads, or pointer listeners. */
export function WorkspaceSculpture() {
  return (
    <div className="workspace-sculpture" aria-hidden="true">
      <div className="sculpture-orbit orbit-one" />
      <div className="sculpture-orbit orbit-two" />
      <div className="sculpture-platform" />
      <div className="sculpture-sheet sheet-back"><i /><i /><i /></div>
      <div className="sculpture-sheet sheet-front">
        <span className="sculpture-cross">+</span>
        <i /><i /><i />
        <span className="sculpture-check">✓</span>
      </div>
      <div className="sculpture-spark spark-one" />
      <div className="sculpture-spark spark-two" />
    </div>
  );
}
