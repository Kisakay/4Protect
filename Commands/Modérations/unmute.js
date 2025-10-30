const { EmbedBuilder } = require('discord.js');
const db = require('../../Events/loadDatabase');
const config = require('../../config.json');
const sendLog = require('../../Events/sendlog');
const Discord = require('discord.js');

exports.help = {
	name: 'unmute',
	helpname: 'unmute <mention/id>',
	description: "Retire le timeout d'un membre.",
	help: 'unmute <mention/id>',
};

exports.run = async (bot, message, args, config) => {
	const checkPerm = async (message, commandName) => {
		if (config.owners.includes(message.author.id)) {
			return true;
		}

		const publicStatut = await new Promise((resolve, reject) => {
			db.get('SELECT statut FROM public WHERE guild = ? AND statut = ?', [message.guild.id, 'on'], (err, row) => {
				if (err) reject(err);
				resolve(!!row);
			});
		});

		if (publicStatut) {

			const checkPublicCmd = await new Promise((resolve, reject) => {
				db.get(
					'SELECT command FROM cmdperm WHERE perm = ? AND command = ? AND guild = ?',
					['public', commandName, message.guild.id],
					(err, row) => {
						if (err) reject(err);
						resolve(!!row);
					}
				);
			});

			if (checkPublicCmd) {
				return true;
			}
		}

		try {
			const checkUserWl = await new Promise((resolve, reject) => {
				db.get('SELECT id FROM whitelist WHERE id = ?', [message.author.id], (err, row) => {
					if (err) reject(err);
					resolve(!!row);
				});
			});

			if (checkUserWl) {
				return true;
			}

			const checkDbOwner = await new Promise((resolve, reject) => {
				db.get('SELECT id FROM owner WHERE id = ?', [message.author.id], (err, row) => {
					if (err) reject(err);
					resolve(!!row);
				});
			});

			if (checkDbOwner) {
				return true;
			}

			const roles = message.member.roles.cache.map(role => role.id);

			const permissions = await new Promise((resolve, reject) => {
				db.all('SELECT perm FROM permissions WHERE id IN (' + roles.map(() => '?').join(',') + ') AND guild = ?', [...roles, message.guild.id], (err, rows) => {
					if (err) reject(err);
					resolve(rows.map(row => row.perm));
				});
			});

			if (permissions.length === 0) {
				return false;
			}

			const checkCmdPermLevel = await new Promise((resolve, reject) => {
				db.all('SELECT command FROM cmdperm WHERE perm IN (' + permissions.map(() => '?').join(',') + ') AND guild = ?', [...permissions, message.guild.id], (err, rows) => {
					if (err) reject(err);
					resolve(rows.map(row => row.command));
				});
			});

			return checkCmdPermLevel.includes(commandName);
		} catch (error) {
			console.error('Erreur lors de la vérification des permissions:', error);
			return false;
		}
	};

	if (!(await checkPerm(message, exports.help.name))) {
		const noacces = new EmbedBuilder()
			.setDescription("Vous n'avez pas la permission d'utiliser cette commande")
			.setColor(config.color);
		return message.reply({ embeds: [noacces], allowedMentions: { repliedUser: true } }).then(m => setTimeout(() => m.delete().catch(() => { }), 2000));
	}

	const member = message.mentions.members.first() || await message.guild.members.fetch(args[0]).catch(() => null);
	if (!member) {
		return message.reply("Utilisateur introuvable.");
	}

	try {
		await member.timeout(null);
		message.reply(`<@${member.id}> a été unmute.`);
		const embed = new Discord.EmbedBuilder()
			.setColor(config.color)
			.setDescription(`<@${message.author.id}> a unmute <@${member.id}> (${member.id})`)
			.setTimestamp();

		sendLog(message.guild, embed, 'modlog');
	} catch (error) {
		console.error('Erreur lors du unmute :', error);
		return message.reply("Impossible de unmute.");
	}
};
