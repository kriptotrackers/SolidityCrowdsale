const KriptotrackersToken = artifacts.require("KriptotrackersToken.sol");
const KriptotrackersCrowdsale = artifacts.require(
	"KriptotrackersCrowdsale.sol"
);

const ether = n => new web3.utils.toBN(web3.utils.toWei(n.toString(), "ether"));

module.exports = async function(deployer, network, accounts) {
	const _name = "Kriptotrackers Token";
	const _symbol = "KTS";
	const _decimals = 18;

	await deployer.deploy(KriptotrackersToken, _name, _symbol, _decimals);

	const deployedToken = await KriptotrackersToken.deployed();

	//Ropsten
	const _token = deployedToken.address;
	const _wallet = "0x6acC261610161aFff35E39Db0B1093c8C7A3B946";
	const _rate = 150;
	const _cap = ether(5500);
	const _openingTime = 1563210000;
	const _closingTime = 1565888400;
	const _goal = ether(1500);
	const _releaseTime = 1629046800;
	const _fundationFund = "0x0355BD648eDe7e742D026328C62d95d179A46713";
	const _bountiesFund = "0xEAA30C3C83E6daaC23eAbAd1637EFCec5897ACCe";
	const _teamFund = "0x984815B0b0a3c929034c56d9A269C5265D79A97d";

	await deployer.deploy(
		KriptotrackersCrowdsale,
		_wallet,
		_token,
		_rate,
		_cap,
		_openingTime,
		_closingTime,
		_goal,
		_releaseTime,
		_fundationFund,
		_bountiesFund,
		_teamFund
	);

	return true;
};
