import { Workspace } from "./workspace";
/** Serialize saves: a slower old write can never replace a more recent edit. */
export class SaveQueue {
  private tail: Promise<void> = Promise.resolve();
  constructor(private write: (workspace: Workspace) => Promise<void>) {}
  save(workspace: Workspace) {
    const next = this.tail.catch(() => {}).then(() => this.write(workspace));
    this.tail = next;
    return next;
  }
}
