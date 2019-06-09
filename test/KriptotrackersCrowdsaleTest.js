import ether from "./helpers/ether";
import EVMRevert from "./helpers/EVMRevert.js";
import { increaseTimeTo, duration } from "./helpers/increaseTime";
import latestTime from "./helpers/latestTime";

const KriptotrackersCrowdsale = artifacts.require("KriptotrackersCrowdsale");
const KriptotrackersToken = artifacts.require("KriptotrackersToken");

require("chai")
	.use(require("chai-as-promised"))
	.should();
const { BN } = require("openzeppelin-test-helpers");
const TokenTimelock = artifacts.require("TokenTimelock");

contract("KriptotrackersCrowdsale", function([
	_,
	wallet,
	investor1,
	investor2,
	investor3,
	investor4,
	bountiesFund,
	fundationFund,
	teamFund
]) {
	const _name = "Kriptotrackers Token";
	const _symbol = "KTS";
	const _decimals = new BN(18);

	beforeEach(async function() {
		const latestBlock = await web3.eth.getBlock("latest");
		this.preIcoStage = 0;
		this.icoStage = 1;
		this.preIcoRate = 150;
		this.icoRate = 100;

		this.wallet = wallet;
		this.token = await KriptotrackersToken.new(_name, _symbol, _decimals);
		this.rate = 150;
		this.cap = ether(5.5);
		this.openingTime = latestBlock.timestamp + duration.weeks(1);
		this.closingTime = this.openingTime + duration.weeks(1);
		this.goal = ether(2);
		this.releaseTime = this.closingTime + duration.weeks(1);
		this.fundationFund = fundationFund;
		this.bountiesFund = bountiesFund;
		this.teamFund = teamFund;

		this.soldTokens = 0;

		this.crowdsale = await KriptotrackersCrowdsale.new(
			this.wallet,
			this.token.address,
			this.rate,
			this.cap,
			this.openingTime,
			this.closingTime,
			this.goal,
			this.releaseTime,
			this.fundationFund,
			this.bountiesFund,
			this.teamFund
		);

		await this.token.addMinter(this.crowdsale.address);
		await this.token.addPauser(this.crowdsale.address);
		await this.token.pause();
		await increaseTimeTo(this.openingTime + 1);
		await this.crowdsale.addAddressesToWhitelist([
			investor1,
			investor2,
			investor3
		]);
	});

	describe("Token", function() {
		it("La direccion del contrato debe conincidir con la direccion del KTS", async function() {
			const token = await this.crowdsale.token();
			token.should.equal(this.token.address);
		});

		it("El rate al inicio de la venta debe ser 150", async function() {
			await this.crowdsale.rate().should.be.rejectedWith(EVMRevert);
			//rate.should.be.bignumber.equal(new BN(this.rate));
		});

		it("El beneficiario debe ser la direccion de turing XXX", async function() {
			const wallet = await this.crowdsale.wallet();
			wallet.should.equal(this.wallet);
		});
	});

	describe("Compras", function() {
		it("El contrado debe se capaz emitir tokens", async function() {
			const isMinter = await this.token.isMinter(this.crowdsale.address);
			isMinter.should.equal(true);
		});

		it("El contrado debe se capaz de quitar pausa a los tokens", async function() {
			const isPauser = await this.token.isPauser(this.crowdsale.address);
			isPauser.should.equal(true);
		});

		it("El inversionsta debe ser capaz de comprar tokens", async function() {
			const value = ether(1);
			await this.crowdsale.sendTransaction({
				value: value,
				from: investor1
			}).should.be.fulfilled;
			await this.crowdsale.buyTokens(investor1, {
				value: value,
				from: investor2
			}).should.be.fulfilled;
		});
	});

	describe("Whitelisted", function() {
		it("Solo los inversionistas en la whitelist deben poder comprar cuando la venta esta abierta", async function() {
			const value2 = ether(1);
			await this.crowdsale
				.buyTokens(investor4, { value: value2, from: investor4 })
				.should.be.rejectedWith(EVMRevert);
		});
	});

	describe("Prueba Hard y low cap de inversionista", function() {
		describe("El monto minimo de inversion sera de 0.5 ETH", function() {
			it("Rechaza transacciones menores a 0.5 ether", async function() {
				const value = ether(0.49);
				await this.crowdsale
					.buyTokens(investor1, { value: value, from: investor2 })
					.should.be.rejectedWith(EVMRevert);
			});
		});

		describe("Cuando el inversionista ya ha superado el minimo invertido", function() {
			it("Permite al inversionista pagar debajo del limite", async function() {
				const value = ether(1);
				await this.crowdsale.buyTokens(investor1, {
					value: value,
					from: investor2
				}).should.be.fulfilled;
				const value2 = ether(0.5);
				await this.crowdsale.buyTokens(investor1, {
					value: value2,
					from: investor2
				}).should.be.fulfilled;
				const value3 = ether(50);
				await this.crowdsale
					.buyTokens(investor1, { value: value3, from: investor2 })
					.should.be.rejectedWith(EVMRevert);
			});
		});

		describe("Permite al inversionista pagar entre el rango", function() {
			it("Registra el monto ya invertido", async function() {
				const value = ether(2);
				await this.crowdsale.buyTokens(investor1, {
					value: value,
					from: investor2
				}).should.be.fulfilled;
				const contribution = await this.crowdsale.contributions(
					investor1
				);
				contribution.should.be.bignumber.equal(value);
			});
		});
	});

	describe("Transferencia de tokens", function() {
		it("El inversionista no puede mover los tokens hasta el final de la venta", async function() {
			// Buy some tokens first
			await this.crowdsale.buyTokens(investor1, {
				value: ether(1),
				from: investor1
			});
			// Attempt to transfer tokens during crowdsale
			await this.token
				.transfer(investor2, 1, { from: investor1 })
				.should.be.rejectedWith(EVMRevert);
		});
	});

	describe("Emision", function() {
		it("El suministro total debe cambiar", async function() {
			const value = ether(1);
			const originalTotalSupply = await this.token.totalSupply();
			await this.crowdsale.sendTransaction({
				value: value,
				from: investor1
			});
			const newTotalSupply = await this.token.totalSupply();
			assert.isTrue(newTotalSupply > originalTotalSupply);
		});
	});

	describe("Compra Limitada (HARD CAP)", function() {
		it("El hardcap debe ser 5500 ETH", async function() {
			const cap = await this.crowdsale.cap();
			cap.should.be.bignumber.equal = this.cap;
		});
	});

	describe("Fases de la venta", function() {
		it("Inicia como pre ico", async function() {
			const stage = await this.crowdsale.stage();
			stage.should.be.bignumber.equal(new BN(this.preIcoStage));
		});

		it("se sobreescribio el metodo rate", async function() {
			await this.crowdsale.rate().should.be.rejectedWith(EVMRevert);
		});

		it("Antes de los 300 000 KTS se debe actualizar a ICO (rate =100)", async function() {
			await this.crowdsale.buyTokens(investor1, {
				value: ether(1),
				from: investor1
			});
			const stage = await this.crowdsale.stage();
			stage.should.be.bignumber.equal(new BN(this.preIcoStage));
			const rate_post = await this.crowdsale.getCurrentRate();
			rate_post.should.be.bignumber.equal(new BN(this.preIcoRate));
		});

		it("Al pasar los 300 000 KTS se debe actualizar a ICO (rate =150)", async function() {
			await this.crowdsale.buyTokens(investor1, {
				value: ether(4),
				from: investor1
			});
			const stage = await this.crowdsale.stage();
			stage.should.be.bignumber.equal(new BN(this.icoStage));
			const rate_post = await this.crowdsale.getCurrentRate();
			rate_post.should.be.bignumber.equal(new BN(this.icoRate));
		});
	});

	describe("Ventana de tiempo", function() {
		it("La venta esta abierta en el tiempo definido", async function() {
			const isClosed = await this.crowdsale.hasClosed();
			isClosed.should.be.false;
		});
	});

	describe("Reembolso", function() {
		beforeEach(async function() {
			await this.crowdsale.buyTokens(investor1, {
				value: ether(1),
				from: investor1
			});
		});

		describe("Durante la venta", function() {
			it("Durante la venta el inversionista no puede pedir reembolso", async function() {
				await this.crowdsale
					.claimRefund(investor1, { from: investor1 })
					.should.be.rejectedWith(EVMRevert);
			});
		});
	});

	describe("Finalizar venta", function() {
		describe("Low Cap no alcanzado", function() {
			beforeEach(async function() {
				await this.crowdsale.buyTokens(investor1, {
					value: ether(1),
					from: investor1
				});
				await increaseTimeTo(this.closingTime + 1);
				await this.crowdsale.finalize({ from: _ });
			});

			it("El inversionista debe obtener reembolso", async function() {
				await this.crowdsale.claimRefund(investor1, { from: investor1 })
					.should.be.fulfilled;
			});
		});

		describe("Low Cap alcanzado", function() {
			beforeEach(async function() {
				await this.crowdsale.buyTokens(investor1, {
					value: ether(2.6),
					from: investor1
				});
				await this.crowdsale.buyTokens(investor3, {
					value: ether(2.6),
					from: investor3
				});
				await increaseTimeTo(this.closingTime + 1);

				this.soldTokens = await this.token.totalSupply();
				this.soldTokens = this.soldTokens / 10 ** _decimals;

				await this.crowdsale.finalize();
			});

			it("Meta alcanzada", async function() {
				const goalReached = await this.crowdsale.goalReached();
				goalReached.should.be.true;
				await this.crowdsale
					.claimRefund(investor1, { from: investor1 })
					.should.be.rejectedWith(EVMRevert);

				// Unpauses the token
				const paused = await this.token.paused();
				paused.should.be.false;

				// Enables token transfers
				await this.token.transfer(investor4, 1, { from: investor1 })
					.should.be.fulfilled;

				//Los tokens restandes deben irse al contrato de venta
				let tokensSaleTokens = await this.crowdsale.tokenSaleTokens();
				tokensSaleTokens = tokensSaleTokens / 10 ** _decimals;
				const unsoldTokens = tokensSaleTokens - this.soldTokens;
				const crowdAddress = await this.crowdsale.postICOSaleAddress();
				let balanceSecondCrowdsale = await this.token.balanceOf(
					crowdAddress
				);
				balanceSecondCrowdsale =
					balanceSecondCrowdsale / 10 ** _decimals;
				assert.equal(
					unsoldTokens.toString(),
					balanceSecondCrowdsale.toString()
				);

				// Foundation
				const foundationTimelockAddress = await this.crowdsale.foundationTimelock();

				let foundationTimelockBalance = await this.token.balanceOf(
					foundationTimelockAddress
				);
				foundationTimelockBalance =
					foundationTimelockBalance / 10 ** this.decimals;

				let foundationAmount = await this.crowdsale.fundationTokens();
				foundationAmount = foundationAmount / 10 ** this.decimals;

				assert.equal(
					foundationTimelockBalance.toString(),
					foundationAmount.toString()
				);

				const foundationTimelock = await TokenTimelock.at(
					foundationTimelockAddress
				);
				await foundationTimelock
					.release()
					.should.be.rejectedWith(EVMRevert);

				//Bounties fund
				const bountiesFund = await this.crowdsale.bountiesFund();
				let bountiesTokens = await this.crowdsale.bountiesTokens();
				bountiesTokens = bountiesTokens / 10 ** this.decimals;

				let bountiesBalance = await this.token.balanceOf(bountiesFund);
				bountiesBalance = bountiesBalance / 10 ** this.decimals;

				assert.equal(
					bountiesTokens.toString(),
					bountiesBalance.toString()
				);

				//Dev fund
				const teamFund = await this.crowdsale.teamFund();
				let teamTokens = await this.crowdsale.teamTokens();
				teamTokens = teamTokens / 10 ** this.decimals;

				let teamBalance = await this.token.balanceOf(teamFund);
				teamBalance = teamBalance / 10 ** this.decimals;

				assert.equal(teamTokens.toString(), teamBalance.toString());

				//Solo 1 M KTS
				const totalSupply = await this.token.totalSupply();
				const totalSupplyCrowdsale = await this.crowdsale.max_emision();
				assert.equal(
					totalSupply.toString(),
					totalSupplyCrowdsale.toString()
				);

				// Can withdraw from timelocks
				await increaseTimeTo(this.releaseTime + 10);
				await foundationTimelock.release().should.be.fulfilled;

				// Foundation balance
				const foundationFund = await this.crowdsale.fundationFund();
				let foundationBalance = await this.token.balanceOf(
					foundationFund
				);
				foundationBalance = foundationBalance / 10 ** this.decimals;

				assert.equal(
					foundationBalance.toString(),
					foundationAmount.toString()
				);
			});
		});
	});
});
