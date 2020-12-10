import React from 'react';
import { View, TextInput, Text, ScrollView, Button, TouchableOpacity, Keyboard, TouchableWithoutFeedback, Platform, TouchableHighlight } from 'react-native';
import Auth from '@aws-amplify/auth';
import { Interactions } from '@aws-amplify/interactions';
import {
	LexRuntimeServiceClient,
	PostTextCommand,
  PostContentCommand,
  
} from '@aws-sdk/client-lex-runtime-service';
import Amplify, { ConsoleLogger as Logger, Credentials } from '@aws-amplify/core';
import Voice from '@react-native-community/voice';
import RNFS from 'react-native-fs';
import Sound from 'react-native-sound';
import { PERMISSIONS, requestMultiple } from 'react-native-permissions';
import colors from '../config/colors';

const Buffer = require('buffer/').Buffer

Sound.setCategory('MultiRoute', true);

const logger = new Logger('ChatBot');

const styles = {
  container: {
    flex: 1,
    flexDirection: 'column',
    backgroundColor: colors.WHITE,
    alignItems: 'center',
		alignSelf: 'stretch',
		justifyContent: 'center'
  },
  list: {
    flex: 1,
    flexDirection: 'column',
    alignSelf: 'stretch',
    padding: 5,
  },
  itemMe: {
    textAlign: 'right',
    alignSelf: 'flex-end',
    padding: 8,
    margin: 8,
    backgroundColor: colors.CLOUDS,
    borderRadius: 15,
    overflow: 'hidden',
  },
  itemBot: {
    textAlign: 'left',
    alignSelf: 'flex-start',
    padding: 8,
    margin: 8,
    color: colors.WHITE,
    backgroundColor: colors.PETER_RIVER,
    borderRadius: 15,
    overflow: 'hidden',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal:5
  },
  textInput: {
    flex: 1,
    color: colors.BLACK
  },
  buttonMic: {
    backgroundColor: colors.WHITE,
    paddingLeft: 5,
    paddingRight: 8
  },
  buttonText: {
    backgroundColor: colors.WHITE,
    fontSize: 24
  },
  sendButton: {
    paddingLeft: 8,
    paddingRight: 8
  },
  sendButtonText: {
    color: colors.PETER_RIVER,
    fontSize: 16
  }
};

const STATES = {
  INITIAL: 'INITIAL',
  LISTENING: 'LISTENING',
  SENDING: 'SENDING',
  SPEAKING: 'SPEAKING'
};

const MIC_BUTTON_TEXT = {
  PASSIVE: '🎤',
  RECORDING: '🔴'
}

let timer: any = null;

interface Props {
  botName: string;
  onComplete?: ((err: any, confirmation: any) => any) | undefined;
  styles?: any;
  overrideStyles?: any;
  silenceDelay?: number;
  conversationModeOn?: boolean;
  voiceEnabled?: boolean;
  textEnabled?: boolean;
  welcomeMessage?: string;
};

interface State {
  currentConversationState: string;
  dialog: any[];
  error: string;
  inputText: string;
  inputEditable: boolean;
  micText: string;
  voice: boolean;
  conversationOngoing: boolean;
}

interface BotConfig {
  [key: string]: Object;
}

type BotMessage = {
	content: string;
	options: {
		messageType: 'text';
	};
};



export class ChatBot extends React.Component<Props, State> {
  listItemsRef: React.RefObject<any>;

  static defaultProps = {
    botName: undefined,
    onComplete: undefined,
    styles: {},
    silenceDelay: 1000,
    conversationModeOn: false,
    voiceEnabled: false,
    textEnabled: true
  };

  constructor(props: Props) {
    super(props);
    this.state = {
      dialog: [{
        message: this.props.welcomeMessage || 'To begin, say or type "Start interview!"',
        from: 'system'
      }],
      inputText: '',
      inputEditable: true,
      micText: MIC_BUTTON_TEXT.PASSIVE,
      voice: false,
      conversationOngoing: false,
      currentConversationState: STATES.INITIAL,
      error: ''
    };
    this.listItems = this.listItems.bind(this);
    this.submit = this.submit.bind(this);
    this.listItemsRef = React.createRef();
    this.reset = this.reset.bind(this);

    this.startRecognizing = this.startRecognizing.bind(this);
    this.handleMicButton = this.handleMicButton.bind(this);

    if (this.props.voiceEnabled) {
      if (!Voice || typeof Voice.start !== 'function' ||
        typeof Voice.stop !== 'function' ||
        typeof Voice.isRecognizing !== 'function') {
        throw new Error('Missing react-native-voice')
      }
      if (!Sound) {
        throw new Error('Missing react-native-sound')
      }
      if (!RNFS || typeof RNFS.exists !== 'function' ||
        typeof RNFS.unlink !== 'function' ||
        typeof RNFS.writeFile !== 'function') {
        throw new Error('Missing react-native-fs')
      }

      Voice.onSpeechStart = this.onSpeechStart.bind(this);
      Voice.onSpeechEnd = this.onSpeechEnd.bind(this);
      //Voice.onSpeechError = this.onSpeechError.bind(this);
      Voice.onSpeechResults = this.onSpeechResults.bind(this);
    }

    // const botConfig: BotConfig = {};
    // botConfig[this.props.botName] = { name: this.props.botName, alias: "$LATEST", region: "us-east-1" };
    // Interactions.configure({ bots: botConfig });

  }

  listItems() {
    const { styles: overrideStyles } = this.props;

    return this.state.dialog.map((m, i) => {
      if (m.from === 'me') { return <Text key={i} style={[styles.itemMe, overrideStyles.itemMe]}>{m.message}</Text> }
      else if (m.from === 'system') { return <Text key={i} style={[styles.itemBot, overrideStyles.itemBot]}>{m.message}</Text> }
      else { return <Text key={i} style={[styles.itemBot, overrideStyles.itemBot]}>{m.message}</Text> }
    });
  };

  async submit(voiceResponse: any) {
    console.log("Submitting, input text:", this.state.inputText);
    
    if (!this.state.inputText) {
      return;
    }

    const userMessage = this.state.inputText;

    this.setState({
      dialog: [
        ...this.state.dialog,
        { message: this.state.inputText, from: 'me' },
      ],
      inputText: ''
    });

    let response: any;
		if (voiceResponse === true) {
			const interactionsMessage = {
				content: userMessage,
				options: {
					messageType: 'text',
				}
      };
      response = await this.sendMessage(
        this.props.botName,
        interactionsMessage as BotMessage
      ).catch((err) => {
        console.log(err);
      });
		} else {
			response = await this.sendMessage(
				this.props.botName,
				userMessage as string
			).catch((err) => {
        console.log(err);
      });
    }

    this.setState({
      dialog: [
        ...this.state.dialog,
        response && response.message && { from: 'bot', message: response.message }
      ].filter(Boolean),
      inputEditable: true,
      micText: MIC_BUTTON_TEXT.PASSIVE,
    }, () => {
      setTimeout(() => {
        this.listItemsRef.current.scrollToEnd();
      }, 50);
    });

    if (this.state.voice) {
      this.setState({
        voice: false
      })

      if (!response || !response.hasOwnProperty('audioStream')) {
        console.log('No audioStream returned from bot');
        return;
      }

      const path = `${RNFS.DocumentDirectoryPath}/responseAudio.mp3`;
      const data = (await this.audioStreamToBase64(response.audioStream as Blob)) as string;
      await RNFS.writeFile(path, data, 'base64');
      const speech = new Sound(path, '', async (err) => {
        if (!err) {
          speech.play(async () => {
            speech.release();
            RNFS.exists(path).then((res) => {
              if (res) {
                RNFS.unlink(path)
              }
            })
            if (response.dialogState === 'ElicitSlot' && this.props.conversationModeOn) {
              await this.startRecognizing();
            }
          });
        } else {
          logger.error(err)
        }
      });
    }
  }

  getOnComplete(fn: any) {
    return (...args: any[]) => {
      const message = fn(...args);

      this.setState({
        dialog: [
          ...this.state.dialog,
          message && { from: 'bot', message }
        ].filter(Boolean),
      }, () => {
        setTimeout(() => {
          this.listItemsRef.current.scrollToEnd();
        }, 50);
      });
    }
  }

  componentDidMount() {
    const { onComplete, botName } = this.props;

    requestMultiple(
      Platform.select({
        android: [PERMISSIONS.ANDROID.RECORD_AUDIO],
        ios: [PERMISSIONS.IOS.MICROPHONE, PERMISSIONS.IOS.SPEECH_RECOGNITION],
        default: [PERMISSIONS.ANDROID.RECORD_AUDIO]
      })
    ).then(statuses => {
      console.log('Permissions requested; response:', statuses);
    });

    // if (onComplete && botName) {
    //   Interactions.onComplete(botName, this.getOnComplete(onComplete));
    // }
  }

  componentDidUpdate(prevProps: Props) {
    const { onComplete, botName } = this.props;

    // if ((botName !== prevProps.botName) || (onComplete !== prevProps.onComplete)) {
    //   Interactions.onComplete(botName, this.getOnComplete(onComplete));
    // }
  }

  componentWillUnmount() {
    Voice.destroy().then(Voice.removeAllListeners);
  }

  onSpeechStart(e: any) {
    this.setState({
      currentConversationState: STATES.LISTENING
    });
  };

  async onSpeechEnd(e: any) {
    console.log('Voice.onSpeechEnd called', e);
    
    timer = null;

    if (Platform.OS === 'ios') {
      this.setState({
        currentConversationState: STATES.SENDING,
      });
      await this.submit(true);
    }
  };

  onSpeechError(e: any) {
    console.log('Voice.onSpeechError called', e);
    this.setState({
      error: JSON.stringify(e.error),
    });
  };

  onSpeechResults(e: any) {
    console.log('Voice.onSpeechResults called', e);
    this.setState({
      inputText: (e.value) ? e.value[0] : ''  // modified
    });
    if (timer !== null) {
			clearTimeout(timer);
		}
		timer = setTimeout(async () => {
      await Voice.stop();
      if (Platform.OS === 'android') {
        this.setState({
          currentConversationState: STATES.SENDING,
        });
        await this.submit(true);
      }
		}, this.props.silenceDelay);
  };

  async startRecognizing() {
    this.setState({
      inputText: '',
      inputEditable: false,
      micText: MIC_BUTTON_TEXT.RECORDING,
      voice: true,
    });

    if (this.props.conversationModeOn) {
      this.setState({
        conversationOngoing: true,
      })
    }

    try {
      await Voice.start('en-US');
    } catch (e) {
      logger.error(e);
    }

  };

  async handleMicButton() {
    if (this.state.conversationOngoing || await Voice.isRecognizing()) {
      await this.reset();
    } else {
      await this.startRecognizing();
    }
  }

  async reset() {
    this.setState({
      inputText: '',
      inputEditable: true,
      micText: MIC_BUTTON_TEXT.PASSIVE,
      voice: false,
      conversationOngoing: false,
    });
    await Voice.stop();
  }

  async sendMessage(
		botname: string,
		message: string | BotMessage
	): Promise<Object> {
    const credentials = await Credentials.get();
		if (!credentials) {
			return Promise.reject('No credentials');
		}

		const lexRuntimeServiceClient = new LexRuntimeServiceClient({
			region: 'us-east-1',
			credentials,
		});

		let params;
		if (typeof message === 'string') {
			params = {
				botAlias: '$LATEST',
				botName: botname,
				inputText: message,
				userId: credentials.identityId,
			};

			logger.debug('postText to lex', message);

			try {
				const postTextCommand = new PostTextCommand(params);
				const data = await lexRuntimeServiceClient.send(postTextCommand);
				return data;
			} catch (err) {
				return Promise.reject(err);
			}
		} else {
			params = {
        botAlias: '$LATEST',
        botName: botname,
        contentType: 'text/plain; charset=utf-8',
        inputStream: message.content,
        userId: credentials.identityId,
        accept: 'audio/mpeg',
      };
			logger.debug('postContent to lex', message);
			try {
				const postContentCommand = new PostContentCommand(params);
				const data = await lexRuntimeServiceClient.send(
					postContentCommand
				);
				return data;
			} catch (err) {
				return Promise.reject(err);
			}
		}
  }
  
  audioStreamToBase64(audioStream: Blob): Promise<string | null> {
    const reader = new FileReader();
    reader.readAsDataURL(audioStream);
    return new Promise(resolve => {
      reader.onloadend = () => {
        const dataUrl = reader.result as string | null;
        const base64 = (dataUrl) ? dataUrl.split(',')[1] : null;
        resolve(base64);
      };
    });
  };

  render() {
    const { styles: overrideStyles } = this.props;
    return (
      <View style={{flex: 1}}>
        <TouchableWithoutFeedback onPress={() => Keyboard.dismiss}>
          <ScrollView
            ref={this.listItemsRef}
            style={[styles.list, overrideStyles.list]}
            contentContainerStyle={{flexGrow: 1}}>
            {this.listItems()}
          </ScrollView>
        </TouchableWithoutFeedback>
        <ChatBotInputs
          micText={this.state.micText}
          voiceEnabled={this.props.voiceEnabled}
          textEnabled={this.props.textEnabled}
          styles={styles}
          overrideStyles={overrideStyles}
          onChangeText={(inputText: string) => this.setState({ inputText })}
          inputText={this.state.inputText}
          onSubmitEditing={this.submit}
          editable={this.state.inputEditable}
          handleMicButton={this.handleMicButton}
          submit={this.submit}>
        </ChatBotInputs>
      </View>
    );
  }
}

function ChatBotInputs(props: any) {
  const voiceEnabled = props.voiceEnabled;
  const textEnabled = props.textEnabled;
  const styles = props.styles;
  const overrideStyles = props.overrideStyles;
  const onChangeText = props.onChangeText;
  const inputText = props.inputText;
  const onSubmitEditing = props.onSubmitEditing;
  let editable = props.editable;
  const handleMicButton = props.handleMicButton;
  const micText = props.micText;
  const submit = props.submit;
  let placeholder = ''

  if (voiceEnabled && textEnabled) {
    placeholder = 'Type your message or tap the mic button'
  }

  if (voiceEnabled && !textEnabled) {
    placeholder = 'Tap the mic button'
    editable = false;
  }

  if (!voiceEnabled && textEnabled) {
    placeholder = 'Type your message here'
  }

  if (!voiceEnabled && !textEnabled) {
    return (
      <Text>No Chatbot inputs enabled. Set at least one of voiceEnabled or textEnabled in the props. </Text>
    )
  }

  return (
    <View style={[styles.inputContainer, overrideStyles.inputContainer]}>
      <ChatBotTextInput
        styles={styles}
        overrideStyles={overrideStyles}
        placeholder={placeholder}
        onChangeText={onChangeText}
        inputText={inputText}
        returnKeyType='send'
        onSubmitEditing={onSubmitEditing}
        blurOnSubmit={false}
        editable={editable}
      />
      <ChatBotMicButton
        handleMicButton={handleMicButton}
        styles={styles}
        overrideStyles={overrideStyles}
        micText={micText}
        voiceEnabled={voiceEnabled}
      />
      <ChatBotTextButton
        submit={submit}
        type='submit'
        styles={styles}
        overrideStyles={overrideStyles}
        text={'Send'}
        textEnabled={textEnabled}
      />
    </View>
  )
}

function ChatBotTextInput(props: any) {
  const styles = props.styles;
  const overrideStyles = props.overrideStyles;
  const onChangeText = props.onChangeText;
  const inputText = props.inputText;
  const onSubmitEditing = props.onSubmitEditing;
  const editable = props.editable;
  const placeholder = props.placeholder;

  return (
    <TextInput
      style={[styles.textInput, overrideStyles.textInput]}
      placeholder={placeholder}
      placeholderTextColor={colors.ASBESTOS}
      onChangeText={onChangeText}
      value={inputText}
      returnKeyType="send"
      onSubmitEditing={onSubmitEditing}
      blurOnSubmit={false}
      editable={editable}
      multiline={true}>
    </TextInput>
  )
}

function ChatBotTextButton(props: any) {
  const textEnabled = props.textEnabled;
  const styles = props.styles;
  const overrideStyles = props.overrideStyles;
  const submit = props.submit;

  if (!textEnabled) {
    return null;
  }

  return (
    <TouchableOpacity
      style={styles.sendButton}
      onPress={submit}
    >
      <Text style={styles.sendButtonText}>SEND</Text>
    </TouchableOpacity>
  )
}

function ChatBotMicButton(props: any) {
  const voiceEnabled = props.voiceEnabled;
  const styles = props.styles;
  const overrideStyles = props.overrideStyles;
  const handleMicButton = props.handleMicButton;
  const micText = props.micText;

  if (!voiceEnabled) {
    return null;
  }

  return (
    <TouchableOpacity
      onPress={handleMicButton}
    >
      <View style={styles.buttonMic}>
        {micText === MIC_BUTTON_TEXT.PASSIVE && <Text style={styles.buttonText}>{MIC_BUTTON_TEXT.PASSIVE}</Text>}
        {micText === MIC_BUTTON_TEXT.RECORDING && <Text style={styles.buttonText}>{MIC_BUTTON_TEXT.RECORDING}</Text>}
      </View>
    </TouchableOpacity>
  )
}


export default ChatBot;
