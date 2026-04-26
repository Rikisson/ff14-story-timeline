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
}

function nodeLabel(id: string, scene: Scene): string {
  const preview = scene.text.slice(0, 28);
  return scene.text.length > 28 ? `${id}: ${preview}…` : `${id}: ${preview}`;
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
    const node = new ClassicPreset.Node(nodeLabel(id, scene));
    node.id = id;
    node.addInput('prev', new ClassicPreset.Input(socket));
    node.addOutput('next', new ClassicPreset.Output(socket));
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

  area.addPipe((context) => {
    if (context.type === 'nodetranslated') {
      onMove(context.data.id, context.data.position);
    }
    if (context.type === 'nodepicked') {
      onSelect(context.data.id);
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
  };
}
