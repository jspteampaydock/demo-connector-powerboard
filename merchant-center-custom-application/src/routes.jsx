import { Switch, Route, useRouteMatch } from 'react-router-dom';
import Spacings from '@commercetools-uikit/spacings';
import LiveConnection from './components/live-connection';
import WidgetConfiguration from './components/widget-configuration';
import SandboxConnection from './components/sandbox-connection';
import Log from './components/log';
import Order from './components/order';

const ApplicationRoutes = () => {
  const match = useRouteMatch();

  return (
    <Spacings.Inset scale="xl">
      <Switch>
        <Route path={`${match.path}/liveconnection`}>
          <LiveConnection />
        </Route>
        <Route path={`${match.path}/widgetconfiguration`}>
          <WidgetConfiguration />
        </Route>
        <Route path={`${match.path}/sandboxconnection`}>
          <SandboxConnection />
        </Route>
        <Route path={`${match.path}/log`}>
          <Log />
        </Route>
        <Route path={`${match.path}/orders`}>
          <Order />
        </Route>
      </Switch>
    </Spacings.Inset>
  );
};
ApplicationRoutes.displayName = 'ApplicationRoutes';

export default ApplicationRoutes;
