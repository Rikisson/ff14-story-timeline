import { Injector } from '@angular/core';
import { Scene } from '@features/stories';
import { ClassicPreset, GetSchemes, NodeEditor } from 'rete';
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { AngularArea2D, AngularPlugin, Presets as AngularPresets } from 'rete-angular-plugin/21';

type Schemes = GetSchemes<
  ClassicPreset.Node,
  ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>
>;
type AreaExtra = AngularArea2D<Schemes>;

export interface CreateEditorOptions {
  container: HTMLElement;
  injector: Injector;
  scenes: Record<string, Scene>;
  onMove: (sceneId: string, position: { x: number; y: number }) => void;
  onSelect: (sceneId: string | null) => void;
  onConnect: (fromSceneId: string, toSceneId: string) => void;
  onDisconnect: (fromSceneId: string, toSceneId: string) => void;
}

export interface EditorHandle {
  destroy: () => void;
  addNode: (id: string, scene: Scene) => Promise<void>;
  removeNode: (id: string) => Promise<void>;
  updateLabel: (id: string, scene: Scene) => Promise<void>;
  addConnection: (fromSceneId: string, toSceneId: string) => Promise<void>;
  removeConnection: (fromSceneId: string, toSceneId: string) => Promise<void>;
}

function nodeLabel(id: string, scene: Scene): string {
  const head = scene.label?.trim() || shortId(id);
  const preview = scene.text.slice(0, 28);
  const suffix = scene.text.length > 28 ? '…' : '';
  return scene.text ? `${head}: ${preview}${suffix}` : head;
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

async function buildNode(
  id: string,
  scene: Scene,
  socket: ClassicPreset.Socket,
): Promise<ClassicPreset.Node> {
  const node = new ClassicPreset.Node(nodeLabel(id, scene));
  node.id = id;
  node.addInput('prev', new ClassicPreset.Input(socket, undefined, true));
  node.addOutput('next', new ClassicPreset.Output(socket));
  return node;
}

function findConnection(
  editor: NodeEditor<Schemes>,
  fromId: string,
  toId: string,
): Schemes['Connection'] | undefined {
  return editor.getConnections().find((c) => c.source === fromId && c.target === toId);
}

export async function createEditor(options: CreateEditorOptions): Promise<EditorHandle> {
  const { container, injector, scenes, onMove, onSelect, onConnect, onDisconnect } = options;

  const socket = new ClassicPreset.Socket('scene');
  const editor = new NodeEditor<Schemes>();
  const area = new AreaPlugin<Schemes, AreaExtra>(container);
  const connection = new ConnectionPlugin<Schemes, AreaExtra>();
  const render = new AngularPlugin<Schemes, AreaExtra>({ injector });

  AreaExtensions.selectableNodes(area, AreaExtensions.selector(), {
    accumulating: AreaExtensions.accumulateOnCtrl(),
  });

  render.addPreset(AngularPresets.classic.setup());
  connection.addPreset(ConnectionPresets.classic.setup());

  editor.use(area);
  area.use(connection);
  area.use(render);

  AreaExtensions.simpleNodesOrder(area);

  for (const [id, scene] of Object.entries(scenes)) {
    const node = await buildNode(id, scene, socket);
    await editor.addNode(node);
    await area.translate(id, scene.position);
  }

  for (const [fromId, scene] of Object.entries(scenes)) {
    const fromNode = editor.getNode(fromId);
    if (!fromNode) continue;
    for (const next of scene.next) {
      const toNode = editor.getNode(next.sceneId);
      if (!toNode) continue;
      await editor.addConnection(
        new ClassicPreset.Connection(fromNode, 'next', toNode, 'prev'),
      );
    }
  }

  if (editor.getNodes().length > 0) {
    AreaExtensions.zoomAt(area, editor.getNodes());
  }

  let pickedThisGesture = false;
  let lastEmptyDownAt = 0;
  const DOUBLE_CLICK_MS = 350;
  area.addPipe((context) => {
    if (context.type === 'nodetranslated') {
      onMove(context.data.id, context.data.position);
    }
    if (context.type === 'nodepicked') {
      pickedThisGesture = true;
      onSelect(context.data.id);
    }
    if (context.type === 'pointerdown') {
      pickedThisGesture = false;
      queueMicrotask(() => {
        if (pickedThisGesture) {
          lastEmptyDownAt = 0;
          return;
        }
        const now = Date.now();
        if (now - lastEmptyDownAt < DOUBLE_CLICK_MS) {
          lastEmptyDownAt = 0;
          onSelect(null);
        } else {
          lastEmptyDownAt = now;
        }
      });
    }
    return context;
  });

  editor.addPipe((context) => {
    if (context.type === 'connectioncreated') {
      onConnect(context.data.source, context.data.target);
    }
    if (context.type === 'connectionremoved') {
      onDisconnect(context.data.source, context.data.target);
    }
    return context;
  });

  return {
    destroy: () => area.destroy(),

    addNode: async (id, scene) => {
      const node = await buildNode(id, scene, socket);
      await editor.addNode(node);
      await area.translate(id, scene.position);
    },

    removeNode: async (id) => {
      const connections = editor
        .getConnections()
        .filter((c) => c.source === id || c.target === id);
      for (const conn of connections) {
        await editor.removeConnection(conn.id);
      }
      const node = editor.getNode(id);
      if (node) {
        await editor.removeNode(id);
      }
    },

    updateLabel: async (id, scene) => {
      const node = editor.getNode(id);
      if (!node) return;
      node.label = nodeLabel(id, scene);
      await area.update('node', id);
    },

    addConnection: async (fromId, toId) => {
      if (findConnection(editor, fromId, toId)) return;
      const fromNode = editor.getNode(fromId);
      const toNode = editor.getNode(toId);
      if (!fromNode || !toNode) return;
      await editor.addConnection(
        new ClassicPreset.Connection(fromNode, 'next', toNode, 'prev'),
      );
    },

    removeConnection: async (fromId, toId) => {
      const conn = findConnection(editor, fromId, toId);
      if (conn) await editor.removeConnection(conn.id);
    },
  };
}
