import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { ProjectPackageProductionRunManifest } from "./projectPackageManifest.ts";
import {
  buildProductionRunQueue,
  completeProductionRunTask,
  failProductionRunTask,
  getNextQueuedTask,
  prepareProductionRunTask,
  startProductionRunTask,
  updateProductionRunTaskProgress,
} from "./productionRunQueue.ts";

function makeManifest(
  plan: ProjectPackageProductionRunManifest["productionRunPlan"],
): ProjectPackageProductionRunManifest {
  return {
    version: "1.1",
    workflow: {
      model: "sound-picture-production-run",
      orchestrationHint: "queue-by-shot",
      stages: ["script", "storyboard", "visual", "voice", "subtitle", "composition", "handoff"],
    },
    counts: {
      shots: plan.length,
      productionBriefs: plan.length,
      visualReferences: 0,
      audioIntent: 0,
      handoffNotes: 0,
      warnings: 0,
    },
    shotBriefIndex: [],
    productionRunPlan: plan,
    handoffWarnings: [],
    assetLinks: {
      visualReferenceIds: [],
      audioIntentIds: [],
      handoffNoteIds: [],
    },
  };
}

describe("productionRunQueue", () => {
  it("builds queue tasks from executable production run actions and records blocked manual actions", () => {
    const queue = buildProductionRunQueue(
      makeManifest([
        {
          shotId: "shot-1",
          order: 1,
          title: "镜头 1",
          requiredAssets: ["visual", "voice", "subtitle", "handoff-review"],
          nextActions: [
            "generate-storyboard-image",
            "generate-voice-track",
            "create-subtitle-track",
            "review-handoff-warnings",
          ],
        },
        {
          shotId: "shot-2",
          order: 2,
          title: "镜头 2",
          requiredAssets: [],
          nextActions: ["add-visual-prompt"],
        },
      ]),
      { jobId: "job-1" },
    );

    assert.equal(queue.jobId, "job-1");
    assert.equal(queue.status, "queued");
    assert.equal(queue.totalTasks, 4);
    assert.equal(queue.progress, 0);
    assert.deepEqual(
      queue.tasks.map((task) => task.id),
      [
        "shot-1:generate-storyboard-image",
        "shot-1:generate-voice-track",
        "shot-1:create-subtitle-track",
        "shot-1:review-handoff-warnings",
      ],
    );
    assert.deepEqual(queue.blockedActions, [
      {
        shotId: "shot-2",
        order: 2,
        title: "镜头 2",
        action: "add-visual-prompt",
        reason: "Shot needs a visual prompt before automatic production can run.",
      },
    ]);
  });

  it("moves the next queued task through preparing, running, and completed states", () => {
    let queue = buildProductionRunQueue(
      makeManifest([
        {
          shotId: "shot-1",
          order: 1,
          title: "镜头 1",
          requiredAssets: ["visual", "voice"],
          nextActions: ["generate-storyboard-image", "generate-voice-track"],
        },
      ]),
    );

    const firstTask = getNextQueuedTask(queue);
    assert.equal(firstTask?.id, "shot-1:generate-storyboard-image");

    queue = prepareProductionRunTask(queue);
    assert.equal(queue.status, "preparing");
    assert.equal(queue.activeTaskId, "shot-1:generate-storyboard-image");
    assert.equal(queue.tasks[0]?.status, "preparing");

    queue = startProductionRunTask(queue);
    assert.equal(queue.status, "running");
    assert.equal(queue.tasks[0]?.status, "running");

    queue = updateProductionRunTaskProgress(queue, "shot-1:generate-storyboard-image", 0.5);
    assert.equal(queue.tasks[0]?.progress, 0.5);
    assert.equal(queue.progress, 0.25);

    queue = completeProductionRunTask(queue, "shot-1:generate-storyboard-image");
    assert.equal(queue.status, "queued");
    assert.equal(queue.completedTasks, 1);
    assert.equal(queue.progress, 0.5);

    queue = startProductionRunTask(queue, "shot-1:generate-voice-track");
    queue = completeProductionRunTask(queue, "shot-1:generate-voice-track");
    assert.equal(queue.status, "completed");
    assert.equal(queue.completedTasks, 2);
    assert.equal(queue.failedTasks, 0);
    assert.equal(queue.progress, 1);
  });

  it("marks the queue failed when any task fails and preserves the task error", () => {
    let queue = buildProductionRunQueue(
      makeManifest([
        {
          shotId: "shot-1",
          order: 1,
          title: "镜头 1",
          requiredAssets: ["visual"],
          nextActions: ["generate-storyboard-image"],
        },
      ]),
    );

    queue = startProductionRunTask(queue);
    queue = updateProductionRunTaskProgress(queue, "shot-1:generate-storyboard-image", 0.7);
    queue = failProductionRunTask(queue, "shot-1:generate-storyboard-image", "image api timeout");

    assert.equal(queue.status, "failed");
    assert.equal(queue.completedTasks, 0);
    assert.equal(queue.failedTasks, 1);
    assert.equal(queue.progress, 0.7);
    assert.equal(queue.tasks[0]?.status, "failed");
    assert.equal(queue.tasks[0]?.error, "image api timeout");
  });

  it("returns a completed empty queue when manifest has no executable actions", () => {
    const queue = buildProductionRunQueue(
      makeManifest([
        {
          shotId: "shot-1",
          order: 1,
          title: "镜头 1",
          requiredAssets: [],
          nextActions: ["add-visual-prompt"],
        },
      ]),
    );

    assert.equal(queue.status, "completed");
    assert.equal(queue.totalTasks, 0);
    assert.equal(queue.progress, 1);
    assert.equal(getNextQueuedTask(queue), undefined);
    assert.equal(queue.blockedActions.length, 1);
  });
});
