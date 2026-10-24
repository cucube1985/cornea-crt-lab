import {requireAccess} from './access-ui.js?v=4';
import {serverAccess} from './access-provider.js?v=4';
document.getElementById('access-boot').hidden=true;
await requireAccess(serverAccess());
location.replace(new URL('./',location.href));
