import React from 'react';
import PropTypes from 'prop-types';
import { View, Text, ScrollView } from 'react-native';
import { connect } from 'react-redux';
import moment from 'moment';
import { SafeAreaView } from 'react-navigation';

import Status from '../../containers/Status';
import Avatar from '../../containers/Avatar';
import styles from './styles';
import sharedStyles from '../Styles';
import database from '../../lib/realm';
import RocketChat from '../../lib/rocketchat';
import RoomTypeIcon from '../../containers/RoomTypeIcon';
import I18n from '../../i18n';
import { CustomHeaderButtons, Item } from '../../containers/HeaderButton';
import StatusBar from '../../containers/StatusBar';
import log from '../../utils/log';

const PERMISSION_EDIT_ROOM = 'edit-room';

const camelize = str => str.replace(/^(.)/, (match, chr) => chr.toUpperCase());
const getRoomTitle = (room, type, name) => (type === 'd'
	? <Text testID='room-info-view-name' style={styles.roomTitle}>{name}</Text>
	: (
		<View style={styles.roomTitleRow}>
			<RoomTypeIcon type={room.prid ? 'discussion' : room.t} key='room-info-type' />
			<Text testID='room-info-view-name' style={styles.roomTitle} key='room-info-name'>{room.prid ? room.fname : room.name}</Text>
		</View>
	)
);

@connect(state => ({
	baseUrl: state.settings.Site_Url || state.server ? state.server.server : '',
	user: {
		id: state.login.user && state.login.user.id,
		token: state.login.user && state.login.user.token
	},
	Message_TimeFormat: state.settings.Message_TimeFormat
}))
export default class RoomInfoView extends React.Component {
static navigationOptions = ({ navigation }) => {
	const showEdit = navigation.getParam('showEdit');
	const rid = navigation.getParam('rid');
	return {
		title: I18n.t('Room_Info'),
		headerRight: showEdit
			? (
				<CustomHeaderButtons>
					<Item iconName='edit' onPress={() => navigation.navigate('RoomInfoEditView', { rid })} testID='room-info-view-edit-button' />
				</CustomHeaderButtons>
			)
			: null
	};
}

static propTypes = {
	navigation: PropTypes.object,
	user: PropTypes.shape({
		id: PropTypes.string,
		token: PropTypes.string
	}),
	baseUrl: PropTypes.string,
	Message_TimeFormat: PropTypes.string
}

constructor(props) {
	super(props);
	this.rid = props.navigation.getParam('rid');
	this.t = props.navigation.getParam('t');
	this.roles = database.objects('roles');
	this.sub = {
		unsubscribe: () => {}
	};
	this.state = {
		room: {},
		roomUser: {}
	};
}

async componentDidMount() {
	if (this.t === 'd') {
		const { user } = this.props;
		const roomUserId = RocketChat.getRoomMemberId(this.rid, user.id);
		try {
			const result = await RocketChat.getUserInfo(roomUserId);
			if (result.success) {
				this.setState({ roomUser: result.user });
			}
		} catch (error) {
			log('err_get_user_info', error);
		}
		return;
	}
	const rooms = database.objects('subscriptions').filtered('rid = $0', this.rid);
	let room = {};
	if (rooms.length > 0) {
		this.setState({ room: rooms[0] });
		[room] = rooms;
	} else {
		try {
			const result = await RocketChat.getRoomInfo(this.rid);
			if (result.success) {
				// eslint-disable-next-line prefer-destructuring
				room = result.room;
				this.setState({ room });
			}
		} catch (error) {
			log('err_get_room_info', error);
		}
	}
	const permissions = RocketChat.hasPermission([PERMISSION_EDIT_ROOM], room.rid);
	if (permissions[PERMISSION_EDIT_ROOM] && !room.prid) {
		const { navigation } = this.props;
		navigation.setParams({ showEdit: true });
	}
}

getRoleDescription = (id) => {
	const role = database.objectForPrimaryKey('roles', id);
	if (role) {
		return role.description;
	}
	return null;
}

isDirect = () => this.t === 'd'

updateRoom = () => {
	if (this.rooms.length > 0) {
		this.setState({ room: JSON.parse(JSON.stringify(this.rooms[0])) });
	}
}

renderItem = (key, room) => (
	<View style={styles.item}>
		<Text style={styles.itemLabel}>{I18n.t(camelize(key))}</Text>
		<Text
			style={[styles.itemContent, !room[key] && styles.itemContent__empty]}
			testID={`room-info-view-${ key }`}
		>{ room[key] ? room[key] : I18n.t(`No_${ key }_provided`) }
		</Text>
	</View>
);

renderRole = (role) => {
	const description = this.getRoleDescription(role);
	if (description) {
		return (
			<View style={styles.roleBadge} key={role}>
				<Text style={styles.role}>{ this.getRoleDescription(role) }</Text>
			</View>
		);
	}
	return null;
}

renderRoles = () => {
	const { roomUser } = this.state;
	if (roomUser && roomUser.roles && roomUser.roles.length) {
		return (
			<View style={styles.item}>
				<Text style={styles.itemLabel}>{I18n.t('Roles')}</Text>
				<View style={styles.rolesContainer}>
					{roomUser.roles.map(role => this.renderRole(role))}
				</View>
			</View>
		);
	}
	return null;
}

renderTimezone = () => {
	const { roomUser } = this.state;
	const { Message_TimeFormat } = this.props;

	if (roomUser) {
		const { utcOffset } = roomUser;

		if (!utcOffset) {
			return null;
		}
		return (
			<View style={styles.item}>
				<Text style={styles.itemLabel}>{I18n.t('Timezone')}</Text>
				<Text style={styles.itemContent}>{moment().utcOffset(utcOffset).format(Message_TimeFormat)} (UTC { utcOffset })</Text>
			</View>
		);
	}
	return null;
}

renderAvatar = (room, roomUser) => {
	const { baseUrl, user } = this.props;

	return (
		<Avatar
			text={room.name || roomUser.username}
			size={100}
			style={styles.avatar}
			type={this.t}
			baseUrl={baseUrl}
			userId={user.id}
			token={user.token}
		>
			{this.t === 'd' && roomUser._id ? <Status style={[sharedStyles.status, styles.status]} size={24} id={roomUser._id} /> : null}
		</Avatar>
	);
}

renderBroadcast = () => (
	<View style={styles.item}>
		<Text style={styles.itemLabel}>{I18n.t('Broadcast_Channel')}</Text>
		<Text
			style={styles.itemContent}
			testID='room-info-view-broadcast'
		>{I18n.t('Broadcast_channel_Description')}
		</Text>
	</View>
)

renderCustomFields = () => {
	const { roomUser } = this.state;
	if (roomUser) {
		const { customFields } = roomUser;

		if (!roomUser.customFields) {
			return null;
		}

		return (
			Object.keys(customFields).map((title) => {
				if (!customFields[title]) {
					return;
				}
				return (
					<View style={styles.item} key={title}>
						<Text style={styles.itemLabel}>{title}</Text>
						<Text style={styles.itemContent}>{customFields[title]}</Text>
					</View>
				);
			})
		);
	}
	return null;
}

renderChannel = () => {
	const { room } = this.state;
	return (
		<React.Fragment>
			{this.renderItem('description', room)}
			{this.renderItem('topic', room)}
			{this.renderItem('announcement', room)}
			{room.broadcast ? this.renderBroadcast() : null}
		</React.Fragment>
	);
}

renderDirect = () => {
	const { roomUser } = this.state;
	return (
		<React.Fragment>
			{this.renderRoles()}
			{this.renderTimezone()}
			{this.renderCustomFields(roomUser._id)}
		</React.Fragment>
	);
}

render() {
	const { room, roomUser } = this.state;
	if (!room) {
		return <View />;
	}
	return (
		<ScrollView style={styles.scroll}>
			<StatusBar />
			<SafeAreaView style={styles.container} testID='room-info-view' forceInset={{ bottom: 'never' }}>
				<View style={styles.avatarContainer}>
					{this.renderAvatar(room, roomUser)}
					<View style={styles.roomTitleContainer}>{ getRoomTitle(room, this.t, roomUser && roomUser.name) }</View>
				</View>
				{this.isDirect() ? this.renderDirect() : this.renderChannel()}
			</SafeAreaView>
		</ScrollView>
	);
}
}
