import { Injector } from '@angular/core';
import { ClassicPreset, GetSchemes, NodeEditor } from 'rete';
import { AreaExtensions, AreaPlugin } from 'rete-area-plugin';
import { ConnectionPlugin, Presets as ConnectionPresets } from 'rete-connection-plugin';
import { AngularArea2D, AngularPlugin, Presets as AngularPresets } from 'rete-angular-plugin/21';

type Schemes = GetSchemes<
  ClassicPreset.Node,
  ClassicPreset.Connection<ClassicPreset.Node, ClassicPreset.Node>
>;
type AreaExtra = AngularArea2D<Schemes>;

export async function createEditor(container: HTMLElement, injector: Injector) {
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

  const sceneA = new ClassicPreset.Node('Scene 1');
  sceneA.addOutput('next', new ClassicPreset.Output(socket));
  await editor.addNode(sceneA);

  const sceneB = new ClassicPreset.Node('Scene 2');
  sceneB.addInput('prev', new ClassicPreset.Input(socket));
  sceneB.addOutput('next', new ClassicPreset.Output(socket));
  await editor.addNode(sceneB);

  const sceneC = new ClassicPreset.Node('Scene 3');
  sceneC.addInput('prev', new ClassicPreset.Input(socket));
  await editor.addNode(sceneC);

  await area.translate(sceneA.id, { x: 0, y: 0 });
  await area.translate(sceneB.id, { x: 320, y: 0 });
  await area.translate(sceneC.id, { x: 640, y: 0 });

  await editor.addConnection(new ClassicPreset.Connection(sceneA, 'next', sceneB, 'prev'));
  await editor.addConnection(new ClassicPreset.Connection(sceneB, 'next', sceneC, 'prev'));

  AreaExtensions.zoomAt(area, editor.getNodes());

  return { editor, area, destroy: () => area.destroy() };
}
