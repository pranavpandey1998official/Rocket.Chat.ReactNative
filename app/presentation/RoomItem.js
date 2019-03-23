import React from 'react';
import moment from 'moment';
import PropTypes from 'prop-types';
import {
	View, Text, StyleSheet, Animated
} from 'react-native';
import { connect } from 'react-redux';
import { emojify } from 'react-emojione';
import { RectButton } from 'react-native-gesture-handler';
import Swipeable from 'react-native-gesture-handler/Swipeable';

import Avatar from '../containers/Avatar';
import Status from '../containers/Status';
import RoomTypeIcon from '../containers/RoomTypeIcon';
import I18n from '../i18n';
import { isIOS } from '../utils/deviceInfo';
import { CustomIcon } from '../lib/Icons';
import RocketChat from '../lib/rocketchat';
import log from '../utils/log';
// import database from '../lib/realm'; TODO

const PERMISSION_ARCHIVE = 'archive-room';

const styles = StyleSheet.create({
	container: {
		flexDirection: 'row',
		alignItems: 'center',
		marginHorizontal: 15
	},
	centerContainer: {
		flex: 1,
		height: '100%'
	},
	title: {
		flex: 1,
		fontSize: 18,
		color: '#0C0D0F',
		fontWeight: '400',
		marginRight: 5,
		paddingTop: 0,
		paddingBottom: 0
	},
	alert: {
		fontWeight: '600'
	},
	row: {
		flex: 1,
		flexDirection: 'row',
		alignItems: 'flex-start'
	},
	titleContainer: {
		width: '100%',
		marginTop: isIOS ? 5 : 2,
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center'
	},
	date: {
		fontSize: 14,
		color: '#9EA2A8',
		fontWeight: 'normal',
		paddingTop: 0,
		paddingBottom: 0
	},
	updateAlert: {
		color: '#1D74F5',
		fontWeight: '700'
	},
	unreadNumberContainer: {
		minWidth: 23,
		padding: 3,
		borderRadius: 4,
		backgroundColor: '#1D74F5',
		alignItems: 'center',
		justifyContent: 'center'
	},
	unreadNumberText: {
		color: '#fff',
		overflow: 'hidden',
		fontSize: 14,
		fontWeight: '500',
		letterSpacing: 0.56
	},
	status: {
		marginRight: 7,
		marginTop: 3
	},
	markdownText: {
		flex: 1,
		color: '#9EA2A8',
		fontSize: 15,
		fontWeight: 'normal'
	},
	markdownTextAlert: {
		color: '#0C0D0F'
	},
	avatar: {
		marginRight: 10
	},
	actionText: {
		color: 'white',
		fontSize: 14,
		backgroundColor: 'transparent'
	},
	action: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center'
	}
});

const renderNumber = (unread, userMentions) => {
	if (!unread || unread <= 0) {
		return;
	}

	if (unread >= 1000) {
		unread = '999+';
	}

	if (userMentions > 0) {
		unread = `@ ${ unread }`;
	}

	return (
		<View style={styles.unreadNumberContainer}>
			<Text style={styles.unreadNumberText}>{ unread }</Text>
		</View>
	);
};

const attrs = ['name', 'unread', 'userMentions', 'StoreLastMessage', 'alert', 'type'];
@connect(state => ({
	user: {
		id: state.login.user && state.login.user.id,
		username: state.login.user && state.login.user.username,
		token: state.login.user && state.login.user.token
	},
	StoreLastMessage: state.settings.Store_Last_Message,
	baseUrl: state.settings.Site_Url || state.server ? state.server.server : ''
}))
export default class RoomItem extends React.Component {
	static propTypes = {
		type: PropTypes.string.isRequired,
		name: PropTypes.string.isRequired,
		baseUrl: PropTypes.string.isRequired,
		StoreLastMessage: PropTypes.bool,
		_updatedAt: PropTypes.string,
		lastMessage: PropTypes.object,
		favorite: PropTypes.bool,
		alert: PropTypes.bool,
		unread: PropTypes.number,
		isRead: PropTypes.bool,
		userMentions: PropTypes.number,
		id: PropTypes.string,
		onPress: PropTypes.func,
		user: PropTypes.shape({
			id: PropTypes.string,
			username: PropTypes.string,
			token: PropTypes.string
		}),
		avatarSize: PropTypes.number,
		testID: PropTypes.string,
		height: PropTypes.number
	}

	static defaultProps = {
		avatarSize: 48
	}

	shouldComponentUpdate(nextProps) {
		const { lastMessage, _updatedAt, isRead } = this.props;
		const oldlastMessage = lastMessage;
		const newLastmessage = nextProps.lastMessage;

		if (oldlastMessage && newLastmessage && oldlastMessage.ts !== newLastmessage.ts) {
			return true;
		}
		if (_updatedAt && nextProps._updatedAt && nextProps._updatedAt !== _updatedAt) {
			return true;
		}
		if (isRead !== nextProps.isRead) {
			return true;
		}
		// eslint-disable-next-line react/destructuring-assignment
		return attrs.some(key => nextProps[key] !== this.props[key]);
	}

	get avatar() {
		const {
			type, name, avatarSize, baseUrl, user
		} = this.props;
		return <Avatar text={name} size={avatarSize} type={type} baseUrl={baseUrl} style={styles.avatar} user={user} />;
	}

	get lastMessage() {
		const {
			lastMessage, type, StoreLastMessage, user
		} = this.props;

		if (!StoreLastMessage) {
			return '';
		}
		if (!lastMessage) {
			return I18n.t('No_Message');
		}

		let prefix = '';
		const me = lastMessage.u.username === user.username;

		if (!lastMessage.msg && Object.keys(lastMessage.attachments).length > 0) {
			if (me) {
				return I18n.t('User_sent_an_attachment', { user: I18n.t('You') });
			} else {
				return I18n.t('User_sent_an_attachment', { user: lastMessage.u.username });
			}
		}

		if (me) {
			prefix = I18n.t('You_colon');
		}	else if (type !== 'd') {
			prefix = `${ lastMessage.u.username }: `;
		}

		let msg = `${ prefix }${ lastMessage.msg.replace(/[\n\t\r]/igm, '') }`;
		msg = emojify(msg, { output: 'unicode' });
		return msg;
	}

	get type() {
		const { type, id } = this.props;
		if (type === 'd') {
			return <Status style={styles.status} size={10} id={id} />;
		}
		return <RoomTypeIcon type={type} />;
	}

	formatDate = date => moment(date).calendar(null, {
		lastDay: `[${ I18n.t('Yesterday') }]`,
		sameDay: 'h:mm A',
		lastWeek: 'dddd',
		sameElse: 'MMM D'
	})

	close = () => {
		this.swipeableRow.close();
	};

	canHideRoom = () => {
		const { id } = this.props;
		const permissions = RocketChat.hasPermission([PERMISSION_ARCHIVE], id);
		if (permissions[PERMISSION_ARCHIVE]) {
			return true;
		}
		return false;
	}


	toggleFav = () => {
		try {
			const { id, favorite } = this.props;
			RocketChat.toggleFavorite(id, !favorite);
		} catch (e) {
			log('toggleFav', e);
		}
		this.close();
	}

	/* 	TODO : find out which property of subscriptions API toogleRead is changing and set it accordingly

	setUnread = (unread) => {
		const { id } = this.props;
		const ls = new Date();
		try {
			const [subscription] = database.objects('subscriptions').filtered('rid = $0', id);
			database.write(() => {
				subscription.open = true;
				subscription.alert = false;
				subscription.unread = 0;
				subscription.userMentions = 0;
				subscription.groupMentions = 0;
				subscription.ls = ls;
				subscription.lastOpen = ls;
			});
		} catch (e) {
			log('toggleRead', e);
		}
	} */

	toggleRead = () => {
		try {
			const { id, isRead } = this.props;
			RocketChat.toggleRead(isRead, id);
		} catch (e) {
			log('toggleFavorite', e);
		}
		this.close();
	}

	toggleHide =() => {
		try {
			const { id, type } = this.props;
			RocketChat.toggleArchiveRoom(id, type, true);
		} catch (e) {
			log('toggleHide', e);
		}
		this.close();
	}

	renderLeftActions = (progress) => {
		const { isRead } = this.props;
		const trans = progress.interpolate({
			inputRange: [0, 1],
			outputRange: [-80, 0]
		});
		return (
			<View style={{ width: 80, flexDirection: 'row' }}>
				<Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
					<RectButton
						style={[styles.action, { backgroundColor: '#1d74f5' }]}
						onPress={this.toggleRead}
					>
						{isRead ? (
							<React.Fragment>
								<CustomIcon size={15} name='flag' color='white' />
								<Text style={styles.actionText}>Unread</Text>
							</React.Fragment>
						) : (
							<React.Fragment>
								<CustomIcon size={15} name='check' color='white' />
								<Text style={styles.actionText}>Read</Text>
							</React.Fragment>
						)}
					</RectButton>
				</Animated.View>
			</View>
		);
	};

	renderRightActions = (progress) => {
		const { favorite } = this.props;
		const canHideRoom = this.canHideRoom();
		const width = canHideRoom ? 160 : 80;
		const trans = progress.interpolate({
			inputRange: [0, 1],
			outputRange: [width, 0]
		});
		return (
			<View style={{ width, flexDirection: 'row' }}>
				<Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
					<RectButton
						style={[styles.action, { backgroundColor: '#F4BD3E' }]}
						onPress={this.toggleFav}
					>
						{favorite ? (
							<React.Fragment>
								<CustomIcon size={17} name='Star-filled' color='white' />
								<Text style={styles.actionText}>Unfavorite</Text>
							</React.Fragment>
						) : (
							<React.Fragment>
								<CustomIcon size={17} name='star' color='white' />
								<Text style={styles.actionText}>Favorite</Text>
							</React.Fragment>
						)}
					</RectButton>
				</Animated.View>
				{ canHideRoom ? (
					<Animated.View style={{ flex: 1, transform: [{ translateX: trans }] }}>
						<RectButton
							style={[styles.action, { backgroundColor: '#55585D' }]}
							onPress={this.toggleHide}
						>
							<CustomIcon size={15} name='eye-off' color='white' />
							<Text style={styles.actionText}>Hide</Text>
						</RectButton>
					</Animated.View>
				) : null
				}
			</View>
		);
	}

	render() {
		const {
			favorite, unread, userMentions, name, _updatedAt, alert, testID, height, onPress
		} = this.props;

		const date = this.formatDate(_updatedAt);

		let accessibilityLabel = name;
		if (unread === 1) {
			accessibilityLabel += `, ${ unread } ${ I18n.t('alert') }`;
		} else if (unread > 1) {
			accessibilityLabel += `, ${ unread } ${ I18n.t('alerts') }`;
		}

		if (userMentions > 0) {
			accessibilityLabel += `, ${ I18n.t('you_were_mentioned') }`;
		}

		if (date) {
			accessibilityLabel += `, ${ I18n.t('last_message') } ${ date }`;
		}

		return (
			<Swipeable
				ref={(ref) => { this.swipeableRow = ref; }}
				friction={3}
				leftThreshold={30}
				rightThreshold={40}
				renderLeftActions={this.renderLeftActions}
				renderRightActions={this.renderRightActions}
			>

				<RectButton
					onPress={onPress}
					activeOpacity={0.8}
					underlayColor='#e1e5e8'
					testID={testID}
				>
					<View
						style={[styles.container, favorite && styles.favorite, height && { height }]}
						accessibilityLabel={accessibilityLabel}
					>
						{this.avatar}
						<View style={styles.centerContainer}>
							<View style={styles.titleContainer}>
								{this.type}
								<Text style={[styles.title, alert && styles.alert]} ellipsizeMode='tail' numberOfLines={1}>{ name }</Text>
								{_updatedAt ? <Text style={[styles.date, alert && styles.updateAlert]} ellipsizeMode='tail' numberOfLines={1}>{ date }</Text> : null}
							</View>
							<View style={styles.row}>
								<Text style={[styles.markdownText, alert && styles.markdownTextAlert]} numberOfLines={2}>
									{this.lastMessage}
								</Text>
								{renderNumber(unread, userMentions)}
							</View>
						</View>
					</View>
				</RectButton>
			</Swipeable>
		);
	}
}
