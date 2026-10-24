// This edition is intentionally limited to this laptop. Cloud/LAN environment
// settings must not turn it into a network listener or change the login origin.
export function localServerConfig(){
  return Object.freeze({host:'127.0.0.1',port:4173,origin:'http://127.0.0.1:4173',trustProxy:false});
}
