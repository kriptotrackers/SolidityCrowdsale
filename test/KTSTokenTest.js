const KriptotrackersToken = artifacts.require("KriptotrackersToken");
require('chai').should();
const { BN } = require('openzeppelin-test-helpers');

contract('KriptotrackersToken',accounts=>{
	const _name='Kriptotrackers Token';
	const _symbol='KTS';
	const _decimals = new BN(18);

	beforeEach(async function(){
		this.token=await KriptotrackersToken.new(_name,_symbol,_decimals);
	});

	describe('token atributes',function(){
		it('has correct name',async function(){
			const name=await this.token.name();
			name.should.equal(_name);
		});

		it('has a symbol', async function () {
			//console.log(this.token);
    		(await this.token.symbol()).should.be.equal(_symbol);
		});

		it('has an amount of decimals', async function () {
    		(await this.token.decimals()).should.be.bignumber.equal(_decimals);
		});
	})
})
