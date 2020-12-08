/**
 * @format
 */

import {AppRegistry} from 'react-native';
import Amplify, { Auth } from 'aws-amplify';
import App from './App';
import {name as appName} from './app.json';

Amplify.configure({
  Auth: {
    region: 'us-east-1',
    identityPoolId: 'us-east-1:0cd56a01-2b75-4ddc-8904-b7352c29952e',
    userPoolId: 'us-east-1_543qq0FaA',
    userPoolWebClientId: '5a2su7pf41gpmrbvjaam1qgf5a',
  },
  Analytics: {
    disabled: true
  }
});

AppRegistry.registerComponent(appName, () => App);
