import { Component, OnInit, HostBinding, Input } from '@angular/core';

/**
 * @group Layout
 * @component Card
 * @description Lorem ipsum dolor sit amet, consectetur adipiscing elit.
 */
@Component({
  selector: 'x-card',
  templateUrl: './card.component.html',
  styleUrls: ['./card.component.css']
})
export class CardComponent implements OnInit {
  @HostBinding('class.padding') hasPadding: boolean = false;

  /**
   * Enable/disable padding on card, default is false
   */
  @Input()
  set padding(value) {
    this.hasPadding = value === true ? true : false;
  }

  constructor() { }

  /**
   * Init card
   */
  ngOnInit() {
  }

}
